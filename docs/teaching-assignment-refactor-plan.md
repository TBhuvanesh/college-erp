# Teaching Assignment Refactor — Architecture Plan

Status: DRAFT for review. No schema or code changes made yet.

## 1. Why / Current State

Nine tables independently store `(faculty_id, subject_id, section, academic_year)` or a subset of it, each free to drift from the others: `faculty_subject_assignments` (allocation), `exams`, `results`, `internal_marks`, `attendance`, `teaching_plans`, `course_materials`, `assignments` (LMS), `feedback_*`. Exams already dropped a hard FK to allocation (`faculty_id` nullable in migration 040), which is the specific symptom that motivated this: exam scheduling and allocation can already disagree about who teaches what.

Goal: make `teaching_assignments` (the renamed/extended `faculty_subject_assignments`) the one row every other module points at via a single `teaching_assignment_id` FK, while keeping the system running throughout the transition.

## 2. Teaching Assignment Model

Renaming `faculty_subject_assignments` → `teaching_assignments` in place (same PK, so every future FK addition is a plain `ADD COLUMN ... REFERENCES teaching_assignments(id)` with no PK churn).

```sql
-- migration 041_teaching_assignments_rename.sql
ALTER TABLE faculty_subject_assignments RENAME TO teaching_assignments;

ALTER TABLE teaching_assignments
  ADD COLUMN department_id INTEGER REFERENCES departments(id),
  ADD COLUMN academic_session_id INTEGER REFERENCES academic_calendar_sessions(id), -- or existing session table if one exists; confirm name
  ADD COLUMN start_date DATE,
  ADD COLUMN end_date DATE,
  ADD COLUMN weekly_teaching_hours NUMERIC(4,1);

-- backfill department_id from subjects for existing rows
UPDATE teaching_assignments ta
  SET department_id = s.department_id
  FROM subjects s
  WHERE ta.subject_id = s.id AND ta.department_id IS NULL;

-- existing unique partial index on (subject_id, academic_year, section) WHERE is_active
-- already prevents duplicate active assignments — keep as is, this is the
-- "prevent duplicate Teaching Assignments" guarantee already enforced.

CREATE INDEX idx_teaching_assignments_faculty ON teaching_assignments(faculty_id) WHERE is_active;
CREATE VIEW faculty_subject_assignments AS SELECT * FROM teaching_assignments; -- compat shim, drop after cutover
```

Resulting entity fields: `id, faculty_id, subject_id, department_id, academic_session_id, academic_year, section, status, is_active, start_date, end_date, weekly_teaching_hours, created_by, removed_by, removal_reason, created_at, updated_at` — matches every field in the prompt except "Teaching Load" (mapped to `weekly_teaching_hours`, since "load" needs a unit).

The compat view means anything still querying `faculty_subject_assignments` by name keeps working read-only during the transition; write path moves to `teaching_assignments` immediately.

## 3. Dependent-Table Migration (additive, per your answer)

For each of `exams`, `results`, `internal_marks`, `attendance`, `teaching_plans`, `course_materials`, `assignments`:

```sql
ALTER TABLE <table> ADD COLUMN teaching_assignment_id INTEGER REFERENCES teaching_assignments(id);
CREATE INDEX idx_<table>_teaching_assignment ON <table>(teaching_assignment_id);
```

Backfill script (one-off, per table) resolves existing rows:
```sql
UPDATE <table> t
SET teaching_assignment_id = ta.id
FROM teaching_assignments ta
WHERE t.subject_id = ta.subject_id
  AND t.faculty_id = ta.faculty_id
  AND t.section = ta.section   -- attendance/teaching_plans/lms have section; exams/results resolve via exam→subject+section
  AND ta.academic_year = <derive from row's year/semester>
  AND t.teaching_assignment_id IS NULL;
```
Rows that fail to resolve (orphaned faculty/subject/section combos with no matching allocation) get logged to a `teaching_assignment_backfill_exceptions` table for manual review rather than silently dropped — this surfaces exactly the kind of drift the refactor exists to fix.

`faculty_id`/`subject_id`/`section` columns on these tables stay, nullable-going-forward, and become **read-only derived display columns** populated by a trigger from `teaching_assignment_id` for one release, then removed in a follow-up migration once all controllers write through the new column exclusively. This is the two-step "add, then drop later" you approved — no atomic forced cutover.

## 4. Backend Refactoring

New files:
- `backend/src/repositories/teachingAssignment.repository.ts` — raw-SQL query layer (CRUD, `findByFaculty`, `findBySubjectSection`, `checkDuplicate`)
- `backend/src/services/teachingAssignment.service.ts` — business rules: duplicate prevention (reuses existing partial unique index, catches the constraint violation and surfaces a friendly error), workload aggregation, cascades a `teaching_assignment.created` event to `workflowEngine.service.ts`
- `backend/src/validations/teachingAssignment.validation.ts` — zod/joi schema (match whatever `subjectAllocation.validation.ts` uses today)
- `backend/src/controllers/teachingAssignment.controller.ts`, `backend/src/routes/teachingAssignment.routes.ts` — mounted at `/api/teaching-assignments`, superseding `/api/subject-allocations` (old routes kept, delegate internally to the new service, marked `@deprecated` in comments, removed in a later cleanup PR — no duplicate business logic, just a thin redirect)

Modified files (resolve `teaching_assignment_id` instead of asking for faculty/subject manually):
- `exam.service.ts` / `examSession.service.ts` — on `PATCH /exams/:id/status → Completed`, resolve `teaching_assignment_id` from the exam row and call a new `resultTask.service.ts` to open the result-entry window (see §6)
- `result.service.ts` — marks entry now requires a valid, open result-entry task tied to a `teaching_assignment_id`, not an arbitrary subject pick
- `internalMarks.service.ts`, `attendance.service.ts`, `teachingPlan.service.ts`, `material.service.ts`, `lmsAssignment.service.ts`, `feedback.service.ts` — each gains a `resolveMyTeachingAssignments(facultyId)` call (single shared helper in `teachingAssignment.service.ts`) instead of independent subject lookups

## 5. New Table: Result Entry Tasks

This is the piece the current schema has no equivalent for — "Pending Result Entry Tasks" needs to be a real row, not just a computed view, so it can carry due dates, status, and audit history.

```sql
-- migration 042_result_entry_tasks.sql
CREATE TABLE result_entry_tasks (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  teaching_assignment_id INTEGER NOT NULL REFERENCES teaching_assignments(id),
  faculty_id INTEGER NOT NULL REFERENCES faculty(id),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','draft_saved','submitted_for_approval','published','closed')),
  window_opens_at TIMESTAMP NOT NULL DEFAULT now(),
  window_closes_at TIMESTAMP,
  submitted_at TIMESTAMP,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(exam_id, teaching_assignment_id)
);
CREATE INDEX idx_result_entry_tasks_faculty ON result_entry_tasks(faculty_id) WHERE status != 'closed';
```

`resultTask.service.ts` (new) creates a row here when an exam transitions to `Completed`, driven off the existing `workflow_rules`/`workflow_logs` engine (trigger event `exam.completed` → action `create_result_entry_task`, configured as data not code, matching how 028 already works) rather than a hardcoded hook — this is the "reuse the Workflow Engine" requirement.

## 6. API Changes

| Old | New | Notes |
|---|---|---|
| `POST /api/subject-allocations` | `POST /api/teaching-assignments` | old route delegates, deprecated |
| `GET /api/faculty/:id/subjects` | `GET /api/faculty/:id/teaching-assignments` | powers Faculty Dashboard |
| `POST /api/results` (arbitrary subject_id/faculty_id body) | `POST /api/result-entry-tasks/:taskId/draft`, `POST /api/result-entry-tasks/:taskId/publish` | marks entry now scoped to a task, not free-form |
| n/a | `GET /api/faculty/:id/result-entry-tasks?status=open` | replaces the "Subject" dropdown on Faculty Results page |
| n/a | `GET /api/teaching-assignments/:id/workload` | faculty teaching-load view |

Validation added at the controller layer: reject marks submission unless `result_entry_tasks.status = 'open'` AND `exams.status = 'Completed'` AND the calling faculty's id matches `teaching_assignments.faculty_id` for that task — this is the three-part "Exam Validation" rule from the brief, enforced server-side, not just hidden in the UI.

## 7. Synchronization Strategy

All cross-module effects are workflow-engine actions, not new bespoke code paths:

- `teaching_assignment.created` → notify faculty, invalidate faculty dashboard cache, no direct writes to Teaching Planner/LMS/Attendance (they read live via `teaching_assignment_id` FK, so there's nothing to "sync" — this is the point of the refactor)
- `exam.completed` → `create_result_entry_task` (creates row in §5) → notify faculty
- `result.published` → existing `notification.service.ts` fan-out (student + analytics cache invalidation) + `audit_logs` insert (action=`results_published`, changes=JSONB diff)
- `exam_session.published` → existing academic-calendar event creation (015), extended to also resolve `teaching_assignment_id` per exam row so calendar events can deep-link to the right faculty section

Calendar/notification/audit code already exists (`notification.service.ts`, `audit_logs` table, `academic_calendar_events`) — this refactor wires new triggers into them, it does not create parallel systems.

## 8. Frontend Refactoring (scope only — implementation deferred per your "plan first" answer)

Per AGENTS.md this repo runs a modified Next.js — before touching any of these, read `node_modules/next/dist/docs/` for the current conventions (routing/data-fetching may differ from stock Next.js).

- `admin/subject-allocations/page.tsx`, `hod/subject-allocations/page.tsx` → rename concept to Teaching Assignment Management, same component tree, swap the mutation/query hooks to the new endpoints
- `faculty/dashboard/page.tsx` → "My Teaching Assignments" card replaces ad hoc subject list, links into Planner/Attendance/LMS/Results scoped by `teaching_assignment_id`
- `faculty/results/page.tsx` → replace subject dropdown with a Pending Result Entry Tasks list (`GET /api/faculty/:id/result-entry-tasks`)
- `faculty/teaching-planner/page.tsx`, `faculty/attendance/page.tsx`, `faculty/lms/page.tsx` → each drops its own subject-selection UI, consumes `GET /api/faculty/:id/teaching-assignments` as the single source for the picker
- `components/SubjectAllocation/` → rename/extend, do not duplicate into a parallel `TeachingAssignment/` tree

## 9. Testing Plan

- Migration: run 041/042 against a snapshot of prod-shaped seed data, verify the compat view returns identical rows to the old table, verify backfill exception table is empty (or reviewed) before dropping old columns in the follow-up migration
- Unit: `teachingAssignment.service.ts` duplicate-prevention (expect constraint-violation → friendly 409), workload aggregation math
- Integration: exam status → `Completed` transition creates exactly one `result_entry_tasks` row per resolved teaching assignment; marks submission rejected when task not `open` or faculty mismatch
- Regression: existing Subject Allocation admin flows (create/transfer/deactivate) still work through the deprecated route shim
- E2E (once frontend lands): faculty logs in → sees teaching assignments on dashboard → exam completes → task appears in Results page → publish → student dashboard reflects it

## 10. File Creation Order

1. `041_teaching_assignments_rename.sql` (+ compat view)
2. `042_result_entry_tasks.sql`
3. Dependent-table `ADD COLUMN teaching_assignment_id` migrations (one file per table or combined) + backfill script + exceptions table
4. `teachingAssignment.repository.ts` → `teachingAssignment.service.ts` → `teachingAssignment.validation.ts` → `teachingAssignment.controller.ts` → `teachingAssignment.routes.ts`
5. `resultTask.service.ts` + workflow_rules seed row for `exam.completed`
6. Update `result.service.ts`/`.controller.ts` for task-scoped entry
7. Update `attendance.service.ts`, `teachingPlan.service.ts`, `material.service.ts`, `lmsAssignment.service.ts`, `feedback.service.ts` to resolve via teaching assignment
8. Deprecate (not delete) `subjectAllocation.*` by delegating to the new service
9. Frontend: Subject Allocation admin page → Faculty Dashboard → Faculty Results → Planner/Attendance/LMS pages, in that order (each is independently shippable)
10. Cleanup migration (later PR): drop derived columns + compat view once all consumers verified on the new path
