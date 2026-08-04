# 11. Business Logic & Module Synchronization Matrix

← [Back to Index](00-INDEX.md)

This section documents core computational business rules as **actually implemented in code**, and explicitly calls out where the planning documents (`BUSINESS_RULES_AND_WORKFLOWS.md`, `ARCHITECT_REVIEW.md`) describe behavior that does not exist yet.

## 11.1 Attendance Calculation

- **Implemented**: one row per (student, subject, date) in `attendance`, `status ∈ {present, absent}`. Cumulative percentage is computed on read (in `attendance.service.ts`/`analytics.service.ts`/`report.service.ts`) as `count(present) / count(total) * 100` — not a stored/materialized column.
- **Not implemented** (described in `BUSINESS_RULES_AND_WORKFLOWS.md` §4 but absent from the schema/code): a `Late` status (schema enum is binary present/absent only, no fractional-absence weighting); a formal correction-window timestamp + HOD-approval gate for post-lock corrections (any admin/faculty can `PATCH /attendance/:id` directly); medical/sports-leave denominator adjustment (no leave-tracking table exists).

## 11.2 Grade / Result Computation

- **Implemented** (`config/grading.ts`): `computeGrade(obtained, maximum, rules?)` maps a percentage to a letter grade via `DEFAULT_GRADE_RULES` (O≥90%, A+≥80%, A≥70%, B+≥60%, B≥55%, C≥50%, else F), and `computeResultStatus(grade, isAbsent, rules?)` derives Pass/Fail/Absent. `results.total_marks` is DB-CHECK-enforced to equal `internal_marks + external_marks`.
- **Single global grading scheme** — the function accepts an optional `rules` override but no caller was found passing anything other than the default; a documented future path exists to move this to a DB-driven `grading_configs` table keyed by (program, regulation) once multiple simultaneous schemes are needed.
- **Not implemented**: CGPA/SGPA aggregation across subjects/semesters (results are per-subject; no `computeCGPA()`/`computeSGPA()` function or `student_gpa` view/table was found) — `UI_UX_BLUEPRINT.md`'s mockups show a CGPA figure on the student dashboard, but the actual aggregation logic for it was not located in the researched services and should be verified before relying on it.

## 11.3 Subject / Curriculum Mapping

- **Implemented**: `subject_curriculum_mappings` resolves "what does department X, program Y, regulation Z teach in year/semester W" — a genuine many-to-many normalization (§6.6). `curriculumRegistry.service.ts` is the single resolution point other modules should call (Teaching Assignment, Teaching Plan roadmap, Import strategies all use it) rather than querying the mapping table directly.

## 11.4 Teaching Assignment Allocation

- **Implemented**: DB-enforced via a partial unique index — one active faculty per (subject, academic_year, section) at a time. `transferTeachingAssignment`/`transferAllocation` handles faculty resignation/substitution by deactivating the old row (`removed_by`, `removal_reason`) and creating a new one, rather than mutating the original row's `faculty_id` — this preserves historical attribution on every dependent record (attendance/marks/exams marked under the old assignment keep pointing at the old `teaching_assignment_id`).
- **Not implemented**: the planning docs' distinct "Substitute" concept (a temporary proxy who can mark attendance but not finalize grades) has no dedicated schema support — a transfer is a full ownership handover, not a temporary delegation.

## 11.5 Mentorship Allocation

- **Implemented**: `mentorGroup.service.suggestBalancedGroups()` computes an even distribution of students across available mentors respecting `mentorship_settings.recommended_students_per_mentor`/`maximum_students`/`allow_cross_department`; three group-formation methods exist (`range`, `section`, `manual` — the `mentor_assignment_method` enum), with `mentor_group_students` supporting arbitrary manual rosters. `checkConflicts()` detects double-assignment before committing.
- **Legacy parallel system**: `mentor_assignments` (1:1 model) still exists and is DB-constrained to one active mentor per student — both models can theoretically coexist for the same student, which is a latent data-consistency risk worth flagging to any team extending this module (verify which model a given feature should read from).

## 11.6 Timetable Generation

- **Implemented**: manual entry model — admin builds `timetable_entries` explicitly, links them to `timetable_slots` (supporting merged/double periods via the join table) and to one-or-more `faculty` (co-teaching support). `POST /timetables/validate-input` performs a structural pre-check.
- **Not implemented**: an automated conflict-free scheduling *generator* (the kind that takes constraints and produces a schedule) — this was an explicit MVP exclusion (`MVP_DEFINITION_AND_DEVELOPMENT_ROADMAP.md` §9, "we won't build algorithmic conflict detection") and no evidence of a constraint-solver was found in `timetable.service.ts` during research; verify directly against that file before assuming conflict detection exists if this becomes a hard requirement.

## 11.7 Academic Year / Semester Promotion

- **Not implemented as an automated process.** There is no "promote all students to next semester" batch operation, no detention/backlog-tracking table, and no ATKT (Allowed To Keep Terms) mechanism described in `BUSINESS_RULES_AND_WORKFLOWS.md` §2. A student's `semester`/`academic_year`/`section` are plain mutable columns updated via `PATCH /students/:id` one at a time (or via the bulk Student Importer in Merge mode, which can update these fields en masse from a fresh spreadsheet — the closest current analog to a promotion workflow, but not purpose-built for it).

## 11.8 Fee / Exam-Eligibility Gating

- **Not implemented.** The planning docs (`SYSTEM_MODEL.md` §7, `BUSINESS_RULES_AND_WORKFLOWS.md` §7/§10) describe Exam Eligibility as depending on both Attendance percentage and Fee clearance. No code path in `examination.service.ts`, `examSeating.service.ts`, or `result.service.ts` was found querying `fees.payment_status` or computed attendance percentage before allowing exam registration, hall-ticket-equivalent seat allocation, or result entry. This is the single most significant gap between the documented business rules and the implemented system — flagged here and in [15-future-and-appendix.md](15-future-and-appendix.md) as the top candidate for the Workflow Rule engine to eventually enforce (a `condition` referencing attendance/fee state, blocking a `result_entry_task` or seat allocation action).

---

## 11.9 Module Synchronization Matrix

This matrix shows, for each row module, which other modules it **reads from** (depends on) and which it **feeds into** (downstream consumers), based on the actual FK/service-call graph documented in [06-database.md](06-database.md) and [09-api-documentation.md](09-api-documentation.md).

| Module | Reads from (upstream) | Feeds into (downstream) |
|---|---|---|
| Departments/Programs | — (foundational) | Students, Faculty, Subjects/Curriculum, Timetable, Opportunity Hub, Announcements, Mentor Groups |
| Students | Departments, Programs | Attendance, Internal Marks, Results, Fees, LMS Submissions, Mentorship, Opportunity Bookmarks, Exam Seating, Timetable (via section), Feedback |
| Faculty | Departments | Teaching Assignment, Attendance, Internal Marks, Exams, LMS, Teaching Plans, Mentorship, Exam Invigilation, Result Entry Tasks |
| Subjects & Curriculum | Departments, Programs | Teaching Assignment, Attendance, Internal Marks, Exams, Results, LMS, Teaching Plans, Timetable, Feedback |
| Teaching Assignment | Faculty, Subjects/Curriculum, Departments | Attendance, Internal Marks, Exams, Teaching Plans, Course Materials, LMS Assignments, Result Entry Tasks, Results |
| Attendance | Students, Faculty, Subjects, Teaching Assignment | Analytics/Reports/Dashboards, Student Experience Timeline |
| Internal Marks | Students, Faculty, Subjects, Teaching Assignment | Results (marks composition), Analytics/Reports |
| Examinations/Sessions/Rooms/Seating/Invigilation | Subjects, Faculty, Students, Departments | Results, Result Entry Tasks, Reports (seating/invigilator print center) |
| Results & Result Entry Tasks | Exams, Teaching Assignment, Students, Faculty | Student Dashboard, Analytics/Reports, Workflow Engine (`marks.published`) |
| Fees | Students, Programs | Student Dashboard, Analytics/Reports, Workflow Engine (`fee.paid`) — **not** wired to Exam Eligibility (§11.8 gap) |
| Timetable | Departments, Programs, Subjects, Faculty | Faculty/Student schedule views, Realtime push |
| LMS (Materials/Assignments/Submissions) | Subjects, Faculty, Students, Teaching Assignment | Teaching Plans (optional lesson↔material/assignment link), Workflow Engine (`material.created`/`assignment.created`) |
| Teaching Plans | Faculty, Subjects, Departments, Course Materials, Assignments | Student Roadmap, Workflow Engine (`lesson.completed`/`lesson.rescheduled`) |
| Mentorship (Groups + Notes) | Faculty, Students, Departments, Mentorship Settings | Reports, Workflow Engine (`mentor.assigned`) |
| Feedback | Departments, Subjects, Faculty, Students (tracking only) | Analytics, Workflow Engine (`feedback.published`) |
| Opportunity Hub | Departments, Students (bookmarks) | Notifications, Calendar Entries |
| Notifications/Announcements | Users, Departments | Realtime push to all roles |
| Academic Calendar/Documents/Parsed Events | Users, Departments | Calendar Entries (aggregated feed), Notifications |
| Academic Data Import | Users | Students (bulk create/update), Import Jobs audit trail |
| Workflow Rule Engine | Users | Notifications, Calendar Entries, Result Entry Tasks (creates on trigger), Workflow Logs |
| Analytics/Reports/Dashboards/Experience | **Everything** (widest fan-in) | Read-only — feeds no other module |
| Search | Students, Faculty, Subjects, Announcements, Calendar, Exams, Rooms, Results, Notifications, Departments | Read-only — feeds no other module |

**Reading the matrix**: Departments/Programs and Subjects/Curriculum are the deepest upstream dependencies (nearly everything reads from them); Analytics/Reports/Search are the widest downstream sinks (they read from nearly everything but feed nothing back). Teaching Assignment is the structural hub — the single module most other transactional modules (Attendance, Marks, Exams, LMS, Teaching Plans, Results) depend on directly via `teaching_assignment_id`.

## 11.10 Entity Lifecycle States (as implemented, cf. planning docs' aspirational versions)

| Entity | Implemented states | Planning-doc aspiration not implemented |
|---|---|---|
| Student | `active, graduated, suspended, inactive` (enum) | No `Applicant`/`Fee Pending`/`Detained`/`Transferred Out`/`Archived (Incomplete)` distinct states — collapses to the 4 enum values above |
| Faculty | `active, on_leave, resigned, retired` (enum) | No substitution/handover state machine (§11.4) |
| Exam | `Scheduled, Ongoing, Completed, Cancelled, Scripts Distributed, Archived` (enum) | Matches planning docs reasonably closely |
| Result | `publication_status: Draft, Published` + `result_status: Pass, Fail, Absent` | No `Final`/post-revaluation-lock state; no distinct revaluation workflow (§8.11) |
| Assignment Submission | `Submitted, Late Submission, Evaluated` (enum) | Matches planning docs' `Draft/Published/Submitted/Graded` reasonably (Draft/Published collapse into the parent `assignments` table having no such states — an assignment is visible to students immediately upon creation, there is no draft state for assignments themselves) |
| Fee | `payment_status: Pending, Partially Paid, Paid, Overdue` (enum) | Matches planning docs' Fee Lifecycle closely; no distinct `Disputed`/`Closed` state |
| Workflow-adjacent (Result Entry Task) | `open, draft_saved, submitted_for_approval, verified, published, closed` (enum) | This is the fullest realization of the planning docs' generic "Maker-Checker" pattern anywhere in the system |
