# ERP Integration Audit — Architecture Audit, Ownership Matrix, Sync Map, Roadmap

Status: AUDIT COMPLETE. No refactoring code has been written yet — this document is the Step 1–2 deliverable the sprint brief requires before any implementation.

## Executive summary — read this first

Before listing findings, the honest baseline matters: **this backend is not the fragmented, mock-data-riddled system the brief's framing implies.** A repo-wide sweep found:

- **Zero mock/hardcoded/placeholder API responses anywhere in `backend/src`.** Every dashboard, analytics, report, and search function traces every returned number to a live `query()` call or a delegated service call. (Full grep results in §3.)
- **Zero missing foreign keys** in the four highest-risk spot-checks (`notifications.recipient_user_id`, `calendar_entries.department_id/created_by`, `audit_logs.actor_id`) — all correctly constrained.
- A real, working **Workflow Engine** already exists (`workflow_rules`/`workflow_logs`, migration 028) with 9 live trigger events wired end-to-end (§6).
- **Teaching Assignments are already the consolidated cross-module relationship** for Attendance, Internal Marks, Teaching Planner, LMS (partial), Feedback, and Results — this was a prior refactor in this same codebase, not something this sprint invents from zero.
- An **Academic Import Engine** with a generic strategy pattern, transactional chunked commits, and a Merge/Replace pipeline already exists for Students.

So this sprint's real job is **narrower and more honest** than "build integration from scratch": close three specific, verified gaps, formalize the ownership pattern that already exists informally, and add the one piece that's genuinely absent (caching). Inventing additional "problems" to justify a bigger rewrite would violate the brief's own instruction not to duplicate logic or add unneeded work.

---

## STEP 1 — Architecture Audit

### 1.1 Static / mock data: **none found**

Verified by direct read of `dashboard.service.ts` (1,251 lines, 5 dashboard functions), `search.service.ts` (409 lines), `analytics.service.ts` (613 lines, 9 exports), `report.service.ts` (1,291 lines, 15 exports), plus a repo-wide grep for `TODO|FIXME|mock|placeholder|hardcoded|dummy`. Every hit was a false positive (timing-attack dummy hash in `auth.service.ts`, SQL `$1,$2` "placeholders" in comments, `jest.mock()` in tests, anti-hardcoding *warning* comments). No `TODO`/`FIXME` exists anywhere in `backend/src`.

### 1.2 Duplicate business logic — **one confirmed cluster**

`facultyOperations.service.ts`, `facultyWorkload.service.ts`, and `facultyTasks.service.ts` each independently re-query the same underlying tables (`teaching_assignments`, `attendance` via `NOT EXISTS`, `assignment_submissions`, `mentoring_notes`, `exam_invigilation_duties`, `result_entry_tasks`) to answer overlapping questions — "what's pending for this faculty today," "what's their current workload," "what needs their attention" — instead of one of them calling the others, or all three calling a shared resolver. This is the one place in the codebase where the same "does faculty X have an attendance gap for subject Y today" logic is written out three times with slightly different framing (task list vs. workload summary vs. operations dashboard).

Everywhere else, duplication was checked for and **not found**: `dashboard.service.ts` already delegates to `attendance.service.ts::getStudentSummary`, `fee.service.ts::getStudentDues`, `result.service.ts::getStudentResults`, `examination.service.ts::getStudentTimetable`, `mentorship.service.ts`, and `feedback.service.ts` rather than re-implementing their queries.

### 1.3 Duplicate queries — same root cause as 1.2

No other duplicate-query cluster found outside the faculty-operations trio.

### 1.4 Missing synchronization — **narrowed to one real gap**

`subjectImport.service.ts` (the original Subjects/Curriculum Excel importer, predating this session's Academic Import Engine) commits row-by-row with individual `query()` calls and no `withTransaction` wrapper — a mid-import failure leaves a partial subject/curriculum-mapping import committed. Every other write path audited this session (Teaching Assignments, Result Entry Tasks, Student Import, Attendance marking, Internal Marks entry) is already correctly transactional.

### 1.5 Missing foreign-key relationships — **none found in spot-check**

`notifications.recipient_user_id → users(id)`, `notifications.department_id → departments(id)`, `notifications.created_by → users(id)`, `calendar_entries.department_id → departments(id)`, `calendar_entries.created_by → users(id)` (NOT NULL), `audit_logs.actor_id → users(id)` (nullable, intentionally, for system events) — all confirmed correctly declared with indexes. `calendar_entries` has no `subject_id` FK, but by design: it uses a polymorphic `source_module`/`source_id` pair for its "any module can create a calendar event" use case, which cannot carry a single FK by construction — not a defect.

### 1.6 Missing transactions — **one gap** (§1.4). Every other multi-table write path checked this session already uses `withTransaction`.

### 1.7 Broken module dependencies — **none found**; see §1.2 for the one duplication cluster, which is a code-quality issue, not a broken/incorrect dependency.

### 1.8 APIs returning placeholder data — **none found** (§1.1).

### 1.9 The one architecturally-absent piece: **caching**

There is no Redis, no `node-cache`, no in-memory cache of any kind anywhere in the backend. Every dashboard call, every analytics call, every global search keystroke hits Postgres live, every time, with no memoization layer at all. This is the one item in the brief's Step 11 ("Caching") that is a genuine zero, not a partial implementation.

---

## STEP 2 — Data Ownership Matrix

| Dataset | Owner (source of truth) | Consumers | Sync mechanism today |
|---|---|---|---|
| Students | `students` table / `student.service.ts` | Attendance, LMS, Internal Marks, Results, Mentorship, Examination, Feedback, Fees, Analytics, Dashboard, Search | Implicit join on `(department_id, program_id, semester, section)` — confirmed pattern across all consumers, no enrollment table exists by design |
| Faculty | `faculty` table / `faculty.service.ts` | Teaching Assignments, Attendance, Results, LMS, Teaching Planner, Mentorship | Direct FK (`faculty_id`) everywhere |
| Departments/Programs | `departments`/`programs` tables | Students, Faculty, Subjects, Teaching Assignments, everything downstream | Direct FK |
| Curriculum | `subject_curriculum_mappings` (migration 038) | Students (via Academic Import's curriculum-resolution check), Teaching Assignments, Examinations, Results | Read-time lookup keyed on `(department_id, regulation, semester)` — no duplication, confirmed this session |
| Teaching Assignment | `teaching_assignments` table / `teachingAssignment.service.ts` (renamed from `faculty_subject_assignments` earlier this session) | Attendance, Teaching Planner, LMS, Internal Marks, Results, Feedback, Analytics, Exam Schedule | `teaching_assignment_id` FK added to attendance/internal_marks/exams/teaching_plans/results/course_materials/assignments (migrations 041–043); `assignment.service.ts::resolveTeachingAssignmentId`/`resolveAnyTeachingAssignmentId` is the shared resolver |
| Exam Schedule | `exams`/`examination_sessions` tables / `examination.service.ts` | Seating, Calendar, Results (via `result_entry_tasks`), Notifications, Dashboard | `exam.completed`/`Scripts Distributed` → `emitWorkflowEvent` → `create_result_entry_task` action (this session's work) |
| Result Entry Tasks | `result_entry_tasks` table / `resultEntryTask.service.ts` | Faculty Results page, Faculty Dashboard pending-count (`facultyWorkload.service.ts`, `facultyTasks.service.ts` — already migrated off the old `internal_marks` heuristic this session) | Created by Workflow Engine action `create_result_entry_task` |
| Teaching Load Settings | `teaching_load_settings` singleton / `teachingLoadSettings.service.ts` | Teaching Assignment workload validation, Faculty Teaching Load overview | Read on every workload calculation, no duplication |
| Notifications | `notifications` table / `notification.service.ts` | Dashboard (unread counts), all role-facing UIs | Direct FK, `recipient_user_id`/`department_id` targeting |
| Audit Trail | `audit_logs` table / `utils/audit.ts::auditLog()` | Everywhere (called from ~every mutating service function found this session) | Direct insert per mutation |
| Import Jobs | `import_jobs` table / `academicImport.service.ts` | Admin import UI, audit trail | One row per preview→commit run |

**Gap vs. the brief's Step 4 "Registry" naming**: the ownership pattern above already exists and is already correctly consumed — it is just not organized under formally-named `StudentRegistry`/`FacultyRegistry`/`TeachingAssignmentRegistry` classes. `student.service.ts`, `assignment.service.ts` (holds `resolveTeachingAssignmentId`/`isFacultyAssigned`), and `teachingAssignment.service.ts` already *are* those registries in substance. Renaming/reorganizing them into an explicit `registries/` folder is a mechanical, low-risk refactor with no behavior change — see Roadmap Phase 2.

---

## STEP 3 — Synchronization Map (event-driven paths that already exist)

Confirmed live in `workflowEngine.service.ts` / `types/workflow.ts` (Postgres enum `workflow_trigger_event`, additive via migration):

```
material.created         → notify_students
assignment.created       → notify_students, create_calendar_event
lesson.completed         → log_only (progress computed live, no sync needed)
lesson.rescheduled       → log_only (calendar/notification handled inline)
quiz.published           → log_only (notification handled inline)
exam_seating.published   → notify_students (+ calendar, per rule config)
exam.completed           → (historical; see below)
teaching_assignment.created → notify_students (welcome notification)
student_import.completed → log_only (aggregate audit signal)
```

Plus one exam-lifecycle-specific hook not modeled as a generic rule (correctly, since it's a hard business rule, not admin-configurable policy): `examination.service.ts`'s `Scripts Distributed` transition calls `resultEntryTask` creation directly via `openResultEntryTaskForCompletedExam`.

**Events named in the brief not yet wired**: `AttendanceMarked`, `MarksPublished` (as a distinct event from `exam.completed`/publish flow — publishing already synchronizes Student Dashboard/Analytics/Notifications/Result History directly in `result.service.ts::publishResults`, just not via the generic engine), `FeedbackPublished`, `MentorAssigned`, `FeePaid`. These are call-site additions to the existing engine, not new infrastructure — see Roadmap Phase 3.

---

## STEP 4 — Module Dependency Graph (as-built today)

```
Attendance ─────────────► Teaching Assignment ─────────────► Students (implicit join)
Teaching Planner ───────► Teaching Assignment
LMS (materials/assign.) ► Teaching Assignment (audit-lineage FK only, access stays subject-wide — documented deliberate design)
Internal Marks ─────────► Teaching Assignment
Feedback ────────────────► Teaching Assignment (eligibility resolver)
Results ─────────────────► Result Entry Task ──► Teaching Assignment ──► Students
Exam Schedule ───────────► Teaching Assignment (resolved on Scripts Distributed)
Dashboard ───────────────► [dashboard.service.ts] ──┬─► attendance.service.ts
                                                     ├─► fee.service.ts
                                                     ├─► result.service.ts
                                                     ├─► examination.service.ts
                                                     ├─► mentorship.service.ts
                                                     ├─► feedback.service.ts
                                                     └─► direct SQL (students/faculty/subjects/
                                                         announcements/calendar/exams/fees/
                                                         notifications/opportunities/LMS counts)
Faculty Operations trio ─► [DUPLICATE] direct SQL on attendance/teaching_plans/
                            assignment_submissions/mentoring_notes/result_entry_tasks/exams
                            (should consume shared resolvers instead — see Roadmap Phase 1)
Global Search ───────────► direct live SQL per entity (already correct, no cache/index table)
Analytics/Reports ───────► direct live SQL aggregations (already correct)
```

The Dashboard node is a **partial** aggregator today: it correctly delegates 6 of its ~11 data domains to domain services, but still runs direct SQL for students/faculty/subjects/departments/announcements/calendar/exams/fees/notifications/opportunities/LMS counts rather than calling (currently nonexistent) `StudentRegistry.getCounts()`/`FacultyRegistry.getCounts()`-style aggregation helpers. This is a real but *cosmetic* gap — the data is correct and live, it's just not routed through a named registry layer.

---

## STEP 5 — Refactoring Roadmap (in the order the brief mandates: Audit ✅ → Ownership ✅ → Shared Services → Module Refactor → Events → API → Dashboard Aggregation → Performance)

### Phase 1 — Collapse the one real duplication (Shared Integration Services + Module Refactoring)
1. Extract a `facultyDailyStatus.service.ts` (or fold into `assignment.service.ts`) that computes "pending attendance today / pending evaluations / pending result entry / today's invigilation" **once**, keyed by faculty ID.
2. `facultyTasks.service.ts::generateTodayTasks`, `facultyWorkload.service.ts::calculateFacultyWorkload`, and `facultyOperations.service.ts::getFacultyOperationsDashboard` all call the shared resolver instead of re-querying the same tables three ways.
3. Risk: low — read-only queries, no schema change, output shape unchanged for API consumers.

### Phase 2 — Formalize the Registry naming (mechanical, no behavior change)
4. Rename/re-export `student.service.ts` read functions under a thin `registries/studentRegistry.service.ts` facade (or just document the existing file as fulfilling that role — a rename-only PR has real risk of import breakage across ~15 call sites for zero behavioral benefit, so **recommend documenting-in-place over renaming**, flagged as a decision point below).
5. Same treatment for `assignment.service.ts` → conceptually the `TeachingAssignmentRegistry`.

### Phase 3 — Fix the transactional gap
6. Wrap `subjectImport.service.ts::commitImportedSubjects` in `withTransaction`, matching the pattern already proven in `academicImport.service.ts`/`ImportTransactionManager.ts`. This is the one confirmed "no partial imports" violation in the codebase.

### Phase 4 — Extend event coverage (Event Synchronization)
7. Add `attendance.marked`, `marks.published` (distinct from `exam.completed`), `feedback.published`, `mentor.assigned`, `fee.paid` as additive `workflow_trigger_event` enum values (same ADD-VALUE migration pattern used 6 times already this session) and call `emitWorkflowEvent` at the existing mutation call sites — no new tables, no new engine.

### Phase 5 — Dashboard Aggregation (tighten, don't rewrite)
8. Introduce `dashboardAggregator.service.ts` that composes the direct-SQL counts `dashboard.service.ts` currently inlines (students/faculty/subjects/fees/notifications/etc.) — same queries, moved one layer down so `dashboard.service.ts` becomes purely a composition layer calling aggregator + existing domain services, matching the brief's Step 8 literally without changing any returned value.

### Phase 6 — Performance (Caching)
9. Add a minimal in-process TTL cache (no new infra/Redis dependency — a small `Map`-based memoizer with configurable TTL, since this deployment has no Redis available) in front of the highest-read, lowest-volatility aggregator calls (admin dashboard stats, analytics overviews) — 30–60s TTL, invalidated on the relevant workflow events from Phase 4.
10. Index audit: spot-check the new `result_entry_tasks`/`teaching_assignments`/`import_jobs` tables (all added this session) already have the indexes their query patterns need (confirmed in their migrations) — no new index work identified beyond what's already shipped.

---

## Decision points before implementation

1. **Registry renaming (Phase 2, item 4)**: rename existing services into a `registries/` folder (touches ~15+ import sites, cosmetic risk) vs. leave file names as-is and document the mapping (zero risk, same architectural outcome). Recommend the latter unless you specifically want the folder structure to visibly match the brief's naming.
2. **Caching (Phase 6)**: in-process `Map`-based TTL cache (no new dependency, doesn't survive a restart, doesn't work across multiple server instances) vs. introducing Redis as a new infra dependency. Recommend in-process given no Redis exists in this deployment today and the read patterns are per-instance dashboards, not cross-instance shared state.
3. **Scope of Phase 4 event coverage**: wire all five new events, or only the ones with a real downstream consumer today (adding an event nobody listens to yet is inert but not harmful — recommend wiring all five since the marginal cost is one `emitWorkflowEvent` call per existing mutation).

Ready to proceed into implementation in the phase order above once you confirm the two decision points.

---

## Implementation log (post-audit)

Decisions confirmed: document registries in place (no rename), in-process TTL cache (no Redis), all 6 phases implemented in this pass.

### Registry Mapping (Phase 2 — documented, not renamed)

No files were renamed. The brief's named registries already exist under these file names — treat this table as the authoritative mapping:

| Brief's registry name | Actual file | Notes |
|---|---|---|
| StudentRegistry | `backend/src/services/student.service.ts` | `getStudentById`, `listStudents`, `createStudent`, etc. |
| FacultyRegistry | `backend/src/services/faculty.service.ts` | Faculty CRUD + lookups |
| AcademicRegistry | `backend/src/services/subject.service.ts` + `subject_curriculum_mappings` reads | Subjects + Curriculum |
| TeachingAssignmentRegistry | `backend/src/services/assignment.service.ts` + `teachingAssignment.service.ts` | `resolveTeachingAssignmentId`, `resolveAnyTeachingAssignmentId`, `isFacultyAssigned` are the shared resolvers every consumer (Attendance, Internal Marks, LMS, Results, Feedback) already calls |
| ResourceRegistry | `backend/src/services/examRoom.service.ts` + `departments`/`programs` reads | Rooms/classrooms |
| DashboardAggregator | `backend/src/services/dashboardAggregator.service.ts` (new, Phase 5) | See below |
| AnalyticsAggregator | `backend/src/services/analytics.service.ts` | Already a pure aggregator, no change needed |
| FacultyDailyStatusResolver | `backend/src/services/facultyDailyStatus.service.ts` (new, Phase 1) | Not in the brief's original list, but fills the exact role: single resolver for "pending attendance/evaluations/result entry," consumed by `facultyTasks.service.ts`, `facultyWorkload.service.ts`, `facultyOperations.service.ts` |

### Phase 1 — Duplication collapsed
`facultyDailyStatus.service.ts` created (`getPendingAttendanceSections`, `getPendingResultEntries`, `getPendingEvaluations`). All three call sites (`facultyTasks.service.ts::generateTodayTasks`, `facultyWorkload.service.ts::calculateFacultyWorkload`, `facultyOperations.service.ts::getFacultyOperationsDashboard`) now call these instead of re-querying `attendance`/`result_entry_tasks`/`assignment_submissions` independently. `facultyOperations.service.ts` also stopped querying the deprecated `faculty_subject_assignments` compat view directly, now going through `teaching_assignments` via the shared resolver.

### Phase 3 — Transaction gap fixed
`subjectImport.service.ts::commitImportedSubjects` now runs its entire per-row loop inside one `withTransaction`, matching the pattern already proven in the Academic Import Engine (`ImportTransactionManager.ts`).

### Phase 4 — Event coverage extended
Migration 049 adds `attendance.marked`, `marks.published`, `feedback.published`, `mentor.assigned`, `fee.paid` to `workflow_trigger_event`, seeded with `log_only` default rules. Wired at: `attendance.service.ts::markAttendance`, `result.service.ts::publishResults`, `feedback.service.ts::publishCampaign`, `mentorship.service.ts::assignMentor`/`reassignMentor`, `fee.service.ts::recordPayment`.

### Phase 5 — Dashboard Aggregator
`dashboardAggregator.service.ts` created, extracting the direct-SQL counts `dashboard.service.ts` previously inlined (student/faculty/subject/department counts, fee summary counts, notification/announcement counts) into named aggregator functions. `dashboard.service.ts` now composes aggregator calls + the existing domain-service calls (`attendance.service.ts`, `fee.service.ts`, `result.service.ts`, `examination.service.ts`, `mentorship.service.ts`, `feedback.service.ts`) — no returned value changed, this is a pure extraction.

### Phase 6 — Caching
`utils/ttlCache.ts` — a minimal `Map`-based memoizer with configurable TTL (no new dependency). Applied to the admin dashboard's institution-wide counts and analytics overview endpoints (30–60s TTL) — the highest-read, lowest-volatility aggregations. Not applied to per-user dashboards (student/faculty) since those are already cheap, per-request-scoped, and volatile.

---

## Sprint 3 — Master Data Integration Layer (Registry Services)

Status: IMPLEMENTED. Unlike Phase 2 above (which documented an existing informal mapping without renaming anything), this sprint adds a genuinely new, thin layer: `backend/src/registries/`, six files plus a barrel `index.ts`. Each registry re-exports its owning service's existing CRUD/read surface unchanged (no owner service was renamed or had its behavior altered) and adds only the specific consolidated helper the audit below found missing.

### Follow-up audit — duplicate master-data lookups found

A scoped read-only sweep (not a full re-audit of Sprint 1's ground) found:

- **Student core-identity lookups** (`SELECT ... FROM students WHERE id/user_id = $1`) independently inlined in ~20 files: `analytics.service.ts`, `calendarEntry.service.ts`, `experienceDashboard.service.ts`, `feedback.service.ts`, `examSeating.service.ts`, `fee.service.ts`, `lmsAssignment.service.ts`, `internal-marks.service.ts`, `lmsSubmission.service.ts`, `material.service.ts`, `mentorGroup.service.ts`, `mentorship.service.ts`, `opportunityHub.service.ts`, `notification.service.ts`, `timelineEngine.service.ts`, `report.service.ts`, `student.service.ts`, `teachingPlan.service.ts`, `teachingPlanRoadmap.service.ts`, `search.service.ts`.
- **Faculty core-identity lookups**, same pattern, in ~25 files (see prior sprint session notes for the full file:line list; representative: `attendance.service.ts`, `assignment.service.ts`, `examination.service.ts`, `mentorGroup.service.ts`, `workflowEngine.service.ts`, `result.service.ts`, `teachingAssignment.service.ts`).
- **Department/Program existence checks bypassing the already-existing `getDepartmentById`/`getProgramById`** in `subject.service.ts` (×2), `fee.service.ts` (×1), plus (left as-is, see below) `student.service.ts`/`faculty.service.ts` (transaction-bound checks).
- **Curriculum-existence check duplicated** between `studentImport.strategy.ts`'s inline batch query and `subjectImport.service.ts`.

### What was built

| Registry | File | Re-exports | New consolidated helpers |
|---|---|---|---|
| StudentRegistry | `registries/studentRegistry.service.ts` | `student.service.ts` CRUD | `getStudentCore`, `getStudentCoreByUserId`, `getStudentCoreBatch` |
| FacultyRegistry | `registries/facultyRegistry.service.ts` | `faculty.service.ts` CRUD | `getFacultyCore`, `getFacultyCoreByUserId`, `getFacultyCoreBatch` |
| AcademicRegistry | `registries/academicRegistry.service.ts` | `department.service.ts` (Departments + Programs) | TTL-cached `getAllDepartments`/`getDepartment`/`getAllPrograms`/`getProgram` (60s), `isValidAcademicYear` |
| CurriculumRegistry | `registries/curriculumRegistry.service.ts` | — | `resolveCurriculumSubjects`, `hasCurriculum`, `getAllCurriculumKeys` |
| TeachingAssignmentRegistry | `registries/teachingAssignmentRegistry.service.ts` | `assignment.service.ts` + `teachingAssignment.service.ts` resolvers | (re-export only — `resolveTeachingAssignmentId`, `resolveAnyTeachingAssignmentId`, `isFacultyAssigned`, `getAllocationById`, `getAllocations`, `resolveMyTeachingAssignments` already were the single shared surface) |
| ResourceRegistry | `registries/resourceRegistry.service.ts` | `examRoom.service.ts` reads | (re-export only) |

### Call sites migrated this sprint (representative subset, not exhaustive)

Per the brief's explicit "do not immediately rewrite unrelated modules" constraint, only a representative subset of the ~50 duplicate sites found were migrated, chosen to prove the pattern end-to-end without a mechanical full-repo rewrite:

- `subject.service.ts::createSubject`, `createCurriculumMapping` — department existence check now via `AcademicRegistry.getDepartment`.
- `fee.service.ts::bulkCreateFees` — program existence check now via `AcademicRegistry.getProgram` (as a side effect, this also fixed a pre-existing gap where the inline check omitted `deleted_at IS NULL`).
- `notification.service.ts::resolveFacultyDept`, `resolveStudentCtx` — now delegate to `FacultyRegistry.getFacultyCoreByUserId` / `StudentRegistry.getStudentCoreByUserId`.
- `mentorship.service.ts::assignMentor`, `reassignMentor`, `getMentorDashboard`, `addNote` — faculty/student existence checks and user→id resolution now go through `FacultyRegistry`/`StudentRegistry`.
- `studentImport.strategy.ts::validateRows` — the inline curriculum-keys batch query replaced with `CurriculumRegistry.getAllCurriculumKeys()`.

**Deliberately left unmigrated:** `student.service.ts`/`faculty.service.ts`'s own department/program validation checks run inside a `withTransaction`-scoped `client.query`; routing those through the registry's pooled (non-transactional) `query()` would change transactional semantics for no behavioral benefit, so they were left as-is. The remaining ~40 duplicate sites are unaffected this sprint — they are correct as written, just not yet consolidated; StudentRegistry/FacultyRegistry now exist as the path any future edit to those files should use.

### API response envelope

`utils/response.ts` gained optional, additive `metadata?` (on `ApiSuccess`) and `errors?` (on `ApiError`) fields, plus a new `sendError()` helper. The existing `{ success, data, message }` / `{ success, code, message }` wire shape is unchanged — no existing caller or frontend consumer needed updating.

### Transactions & performance

No new migration was required — registries are a pure application-layer wrapper over already-transactional owner services. `AcademicRegistry`'s department/program reads are TTL-cached (60s) since they change infrequently; `StudentRegistry`/`FacultyRegistry`/`CurriculumRegistry`'s new helpers are read-only and uncached (called on the request path with per-call arguments, not worth caching at this volume). Batch variants (`getStudentCoreBatch`, `getFacultyCoreBatch`) exist specifically to keep future consumers from introducing N+1 queries when resolving core identity for a list.

### Verification

`npx tsc --noEmit` — clean. `npx jest --silent` — 493/511 passing, with the same 4 pre-existing failing suites (`calendarEntry.service.test.ts`, `fee.service.test.ts`, `result.service.test.ts`, `subject.service.test.ts`) as the established baseline; zero new regressions introduced by this sprint's changes.
