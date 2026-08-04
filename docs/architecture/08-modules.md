# 8. Module Documentation

← [Back to Index](00-INDEX.md)

Each module below follows the same structure: **Purpose · Architecture/Workflow · Backend · Frontend · Database · Dependencies/Relationships · Future Improvements**. Full endpoint listings are in [09-api-documentation.md](09-api-documentation.md); full table schemas in [06-database.md](06-database.md).

---

## 8.1 Identity & Access (Authentication, Users, Roles)

- **Purpose**: Central login/session management and the 4-role RBAC foundation every other module depends on.
- **Workflow**: Login → JWT issuance → per-request stateless verification → refresh rotation → logout/logout-all. Full detail: [07-authentication-and-security.md](07-authentication-and-security.md).
- **Backend**: `auth.routes/controller/service.ts`, `user.service.ts` (shared user-lookup/creation helper reused by Student/Faculty/Accountant provisioning), `middleware/authenticate.ts`, `middleware/authorize.ts`.
- **Frontend**: `app/page.tsx` (login), `context/AuthContext.tsx`, `lib/api.ts`.
- **Database**: `users`, `refresh_tokens`, `audit_logs`.
- **Dependencies**: Everything downstream depends on this module; it has no upstream dependency itself.
- **Future improvements**: MFA, account lockout after N failed attempts, session-device listing/revocation UI.

## 8.2 Student Management

- **Purpose**: Full student record lifecycle — profile, department/program/semester/section placement, status (active/graduated/suspended/inactive).
- **Workflow**: Admin creates a student (auto-provisions a `users` row + `students` row) → student can self-view via `/students/me` → admin updates placement/status over time → soft-delete on exit.
- **Backend**: `students.routes.ts`, `student.controller.ts`, `student.service.ts`, `studentSync.service.ts` (Academic Import's "Student Placement Sync" flow), `registries/studentRegistry.service.ts` (canonical identity lookup used by ~20 other modules).
- **Frontend**: `app/admin/students`, `app/hod/students`, `StudentFormDrawer.tsx`, `hooks/useRegistry.ts`'s `useStudents`.
- **Database**: `students` (see [06-database.md](06-database.md) #6).
- **Relationships**: Feeds Attendance, Internal Marks, Results, Fees, LMS Submissions, Mentorship, Opportunity Bookmarks, Exam Seating, Timetable (via section), Feedback.
- **Future improvements**: Parent portal linkage, formal transfer/lateral-entry workflow (only status enum exists today, no dedicated transfer/backlog tracking table).

## 8.3 Faculty Management & Faculty Operations Center

- **Purpose**: Faculty profile lifecycle plus a consolidated "Operations Center" workspace (today's tasks, workload, daily status, workflow-log audit view).
- **Workflow**: Admin onboards faculty (designation assigned, e.g. `hod` is DB-uniqueness-enforced per department) → faculty logs in to a dashboard aggregating tasks across every module they're assigned to.
- **Backend**: `faculty.routes/controller/service.ts`; `facultyOperations.routes/controller/service.ts` + `facultyDailyStatus.service.ts`/`facultyTasks.service.ts`/`facultyWorkload.service.ts`; `registries/facultyRegistry.service.ts`.
- **Frontend**: `app/admin/faculty`, `app/hod/faculty`, `app/faculty/dashboard`, `FacultyFormDrawer.tsx`/`FacultyDeleteModal.tsx`, `components/UXL/*` (ActionCenter, TodayFocus, SmartProgressCard — heavy use on HOD/Faculty dashboards).
- **Database**: `faculty` (see [06](06-database.md) #7).
- **Relationships**: Every teaching-related module (Attendance, Internal Marks, Exams, LMS, Teaching Plans, Result Entry Tasks) resolves faculty via `teachingAssignmentRegistry` rather than the raw table.
- **Future improvements**: Leave-of-absence / substitution workflow described in planning docs is **not implemented** as a distinct state machine — status enum has `on_leave` but no substitution-handover automation exists.

## 8.4 Accountant Management & Fees

- **Purpose**: Fee invoicing and payment recording for students; Accountant is the narrowest-scoped role (2 frontend routes only).
- **Workflow**: Admin/Accountant bulk-creates fee invoices for a program or explicit student list → student views dues → accountant records a payment (partial or full) → `payment_status` auto-transitions (Pending→Partially Paid→Paid) via DB CHECK-consistent `pending_amount` math.
- **Backend**: `accountant.routes/controller/service.ts`, `fee.routes/controller/service.ts`.
- **Frontend**: `app/accountant/{dashboard,fees}`, `app/admin/fees`, `app/student/fees`.
- **Database**: `accountants`, `fees`, `fee_payments` (see [06](06-database.md) #15–16, #29).
- **Relationships**: Planning docs describe Fee clearance as an Exam-eligibility gate — **not enforced in code**: no query in the researched Examination/Result services checks `fees.payment_status` before hall-ticket/seat-allocation generation (see [11-business-logic-and-sync-matrix.md](11-business-logic-and-sync-matrix.md) for the full gap analysis).
- **Future improvements**: Online payment gateway integration (currently 100% manual entry, by original MVP design — see `MVP_DEFINITION_AND_DEVELOPMENT_ROADMAP.md` §9), automated late-fee application (schema has `payment_status='Overdue'` but no scheduler computes it — see §8.20 Workflow Engine and [12](12-performance-error-handling-workflow.md)).

## 8.5 Departments & Programs (Organizational Structure)

- **Purpose**: Foundational org units — every Student/Faculty/Subject-mapping/Timetable/Opportunity/Announcement scopes to a department; Programs scope degree tracks within a department.
- **Backend**: `departments.routes.ts`, `department.controller/service.ts`; `registries/academicRegistry.service.ts` (TTL-cached facade).
- **Frontend**: Read via dropdowns across nearly every admin/HOD form; color-coding configurable per department (`PUT /departments/:id/color`, used by Exam Seating's visual chart).
- **Database**: `departments`, `programs` (see [06](06-database.md) #4–5).
- **Relationships**: Upstream of nearly everything — see the Synchronization Matrix in [11](11-business-logic-and-sync-matrix.md).

## 8.6 Subjects & Curriculum Mapping

- **Purpose**: The subject catalog (course metadata: credits, L-T-P hours, type) plus the curriculum-placement join (which department/program/regulation/year/semester a subject belongs to) — the single source of truth all downstream academic modules interface with (per `walkthrough.md`).
- **Workflow**: Admin creates/edits subjects and curriculum mappings directly, or bulk-imports via Excel/CSV (`subjectImport.service.ts` — fuzzy department-name matching, e.g. "AI & ML"/"AI/ML"/"CSE" → DB codes) → soft-delete is guarded: the service checks for active allocations/attendance/marks/results/teaching-plans/LMS-materials referencing the subject before allowing deactivation.
- **Backend**: `subjects.routes.ts`, `subject.controller/service.ts`, `subjectImport.service.ts`, `export.service.ts` (shared exporter).
- **Frontend**: `app/admin/subjects` (`SubjectCatalogManager.tsx` — metrics grid, filters, import/export, bulk-wipe with confirmation), `app/admin/courses` (Curriculum Scheme Configurator — year/semester tree with allocation status).
- **Database**: `subjects`, `subject_curriculum_mappings` (see [06](06-database.md) #8–9).
- **Relationships**: Feeds Teaching Assignment, Attendance, Internal Marks, Exams, Results, LMS, Teaching Plans, Timetable, Feedback.
- **Future improvements**: Prerequisite-chain enforcement described in planning docs is not implemented (no `prerequisite_subject_id` column exists).

## 8.7 Teaching Assignment

- **Purpose**: Maps a faculty member to a subject+section+academic-year — the hub every per-class transactional module (Attendance/Marks/Exams/LMS/Teaching-Plans/Result-Entry-Tasks) hangs off of via `teaching_assignment_id`.
- **Workflow**: Admin creates an assignment (validated against `subject_curriculum_mappings`) → a partial unique index prevents two active faculty owning the same subject+year+section simultaneously → `transferAllocation`/`transferTeachingAssignment` reassigns ownership mid-semester (faculty resignation/substitution scenario) with `removed_by`/`removal_reason` audit columns.
- **Backend**: `teachingAssignment.routes/controller/service.ts` (canonical), `subjectAllocation.routes/controller/service.ts` (**deprecated** — zero-logic re-export, kept for backward compatibility), `assignment.service.ts` (legacy resolution helper still used by 4 other modules), `registries/teachingAssignmentRegistry.service.ts` (the canonical `resolveTeachingAssignmentId`/`isFacultyAssigned` check used everywhere).
- **Frontend**: `app/admin/subject-allocations`, `app/hod/subject-allocations` (`AllocationManager.tsx`).
- **Database**: `teaching_assignments` (renamed from `faculty_subject_assignments`, compat VIEW retained — see [06](06-database.md) #10).
- **Relationships**: This is the most heavily depended-upon table in the schema — 8 other tables carry a `teaching_assignment_id` FK.
- **Future improvements**: `academic_session_id` column exists but has no FK (deliberate placeholder for a future formal "Academic Session" entity — currently `academic_year` is just a string on several tables).

## 8.8 Attendance

- **Purpose**: Per-session present/absent recording per student per subject; real-time cumulative percentage exposed to students.
- **Workflow**: Admin defines an "assignment" (attendance-taking scope) → faculty pulls the roster → marks attendance (upsert per session, `UNIQUE(student_id, subject_id, attendance_date)`) → student views summary/history.
- **Backend**: `attendance.routes.ts`, `attendance.controller/service.ts`.
- **Frontend**: `app/faculty/attendance` (roster + Present/Absent/Late touch UI per `UI_UX_BLUEPRINT.md`), `app/student/attendance`, `app/admin/attendance`, `app/hod/attendance`.
- **Database**: `attendance` — **no soft delete**, immutable ledger, corrected via `UPDATE` (see [06](06-database.md) #11).
- **Relationships**: Read by Analytics/Reports/Dashboard/Experience-timeline modules; realtime-pushed via `ATTENDANCE_UPDATED` Socket.IO event.
- ⚠ **Gap vs. planning docs**: the documented "48-hour correction window with HOD approval" (`BUSINESS_RULES_AND_WORKFLOWS.md` §4) and "medical/sports leave denominator adjustment" are **not implemented** — the schema has no correction-window timestamp, approval-request table, or leave-adjustment mechanism; corrections are a direct `PATCH /attendance/:id` with role-based access only (admin/faculty), no maker-checker gate.
- **Future improvements**: implement the documented approval-based correction workflow using the existing Workflow Engine primitives (§8.20).

## 8.9 Internal Marks (Assessments)

- **Purpose**: Records internal assessment scores (Assignment/Mid-1/Mid-2/Lab/Internal types) separate from final Examination results.
- **Backend**: `internal-marks.routes.ts`, `internal-marks.controller/service.ts`.
- **Frontend**: `app/faculty/grades` (bulk entry grid).
- **Database**: `internal_marks` — no soft delete, `UNIQUE(student_id, subject_id, assessment_type)` (see [06](06-database.md) #12).
- **Relationships**: Feeds `results.internal_marks` (via the Results module, not a DB FK — computed/copied at result-creation time).

## 8.10 Examinations (Scheduling, Sessions, Rooms, Seating, Invigilation)

- **Purpose**: The largest single functional family — exam definition, batch scheduling ("examination sessions"), seat allocation, invigilation duty assignment, and conflict detection.
- **Workflow** (orchestration lifecycle via `exam_sessions`/`examSession.routes.ts`): draft → resolve constituent exams → check-conflicts (dry run) → generate seating → generate invigilation → validate → publish → complete → archive.
- **Backend**: `examination.routes/controller/service.ts` (exam CRUD + `examination_sessions` batch scheduling); `examRoom.routes/controller/service.ts` (+ `resourceAvailability.service.ts`, shared availability engine); `examSeating.routes/controller/service.ts` (generate/swap/move/lock/search/analytics); `examInvigilation.routes/controller/service.ts` (generate/suggest/reassign); `examSession.routes/controller/service.ts` (the orchestration layer above); `seatingPattern.routes/controller/service.ts` (department-sequencing templates for seat generation).
- **Frontend**: `app/admin/examinations`, `app/admin/seating` + `app/faculty/invigilation` (`components/Seating/*`), `app/student/examinations`/`app/student/seating`.
- **Database**: `exams`, `examination_sessions`, `exam_sessions`, `exam_session_exams`, `exam_rooms`, `exam_seat_allocations`, `exam_invigilation_duties`, `seating_patterns` (see [06](06-database.md) §6.3.10 for the "two session tables" caveat).
- **Relationships**: Feeds Results (via `exam_id`), Result Entry Tasks, Reports (room-seating-chart, invigilator-sheet, seating-summary print center).
- **Future improvements**: no automated hall-ticket eligibility gate against attendance % or fee clearance was found (see §8.4 and [11](11-business-logic-and-sync-matrix.md)).

## 8.11 Results & Result Entry Tasks

- **Purpose**: Final grade computation and a **task-based approval workflow** for entering/verifying/publishing results per teaching assignment (replacing free-form subject-picking with a driven task queue).
- **Workflow**: `result_entry_tasks` created per (exam, teaching_assignment) → faculty saves a draft (`POST /tasks/:taskId/draft`) → submits for approval (`submitTaskForApproval`) → a verifier approves (`verifyResultEntryTask`) → admin bulk-publishes (`publishResults`) which flips `results.publication_status` Draft→Published and stamps `published_at`. Grade/pass-fail is computed via `config/grading.ts`'s pure functions against `total_marks = internal_marks + external_marks` (DB CHECK-enforced consistency).
- **Backend**: `result.routes/controller/service.ts`, `resultEntryTask.routes/controller/service.ts`, `workflowEngine.service.ts` (drives the submit→verify chain's audit trail).
- **Frontend**: `app/faculty/results`, `app/admin/results`, `app/student/results` (`FacultyGrades` component family).
- **Database**: `results`, `result_entry_tasks` (see [06](06-database.md) #14, #51).
- **Relationships**: Consumes `exams`, `teaching_assignments`; feeds Analytics/Reports/Student dashboard; a `marks.published` workflow-trigger event exists in the Workflow Engine's enum, wiring result publication to configurable notifications.
- **Future improvements**: Revaluation and Supplementary-exam workflows described in planning docs (`BUSINESS_RULES_AND_WORKFLOWS.md` §7) have **no dedicated schema support** (no `revaluation_requests` table, no grade-history versioning) — a published result can only be corrected via a direct `PATCH`, which recomputes grade/status but leaves no distinct "revaluation" audit trail beyond the generic `audit_logs`.

## 8.12 Timetable

- **Purpose**: The newest module in the schema (migration 050) — weekly class scheduling per department/program/year/semester/section, with slot definitions, merged/double-period support, and co-teaching support.
- **Workflow**: Admin defines a timetable shell (working days, slots) → adds entries (subject × day × class-type) → links entries to one-or-more slots (merged periods) and one-or-more faculty (co-teaching) → validates input → publishes (status draft→validated→published→archived, versioned).
- **Backend**: `timetable.routes/controller/service.ts`.
- **Frontend**: `app/admin/timetables`, `app/faculty/timetable`, `app/student/timetable`, `app/hod/classes`.
- **Database**: `timetables`, `timetable_slots`, `timetable_entries`, `timetable_entry_slots`, `timetable_entry_faculty` (see [06](06-database.md) §6.3.11).
- **Relationships**: Realtime-pushed (Socket.IO) alongside Attendance/Teaching-Plan/Exam-Seating changes.
- ⚠ **Gap vs. planning docs**: automated scheduling-conflict detection across faculty/room double-booking was an explicit MVP exclusion (`MVP_DEFINITION_AND_DEVELOPMENT_ROADMAP.md` §9) and the `POST /timetables/validate-input` endpoint appears to be a structural pre-check, not a full conflict solver — should be verified against actual `timetable.service.ts` logic if conflict-free scheduling is a hard requirement going forward.

## 8.13 LMS (Learning Management)

- **Purpose**: Course materials distribution, assignment posting, and student submission/grading.
- **Backend**: `material.routes/controller/service.ts` (upload/download course materials via `uploadLmsFile`), `lmsAssignment.routes/controller/service.ts`, `lmsSubmission.routes/controller/service.ts` (student upload + faculty grading).
- **Frontend**: `app/faculty/lms/[subjectId]`, `app/student/lms/[subjectId]`, `app/admin/lms/[subjectId]`, `components/LMS/{LMSDashboard,SubjectLMS}.tsx` + 4 modals.
- **Database**: `course_materials`, `assignments`, `assignment_submissions` (see [06](06-database.md) §6.3.5).
- **Relationships**: `assignments`/`course_materials` link to `teaching_plans` (a lesson can reference planned material/homework — see §8.14); a `material.created`/`assignment.created` Workflow trigger notifies students automatically.

## 8.14 Teaching Planner (Lesson Progress Engine)

- **Purpose**: Week-by-week lesson planning per teaching assignment, with completion tracking, auto-shift rescheduling, and a student-facing roadmap.
- **Workflow**: Faculty creates sequenced lesson plans (`lesson_sequence`, unique per class) → marks lessons Completed/Rescheduled/Cancelled/In Progress/Partially Completed → `continueLesson` ("Auto Shift Engine") creates a self-referencing continuation row (`parent_lesson_id`) when a lesson runs over → `teachingPlanRoadmap.service.ts` projects the remaining syllabus for students.
- **Backend**: `teachingPlan.routes/controller/service.ts`, `teachingPlanRoadmap.service.ts`.
- **Frontend**: `app/faculty/teaching-planner`, `app/admin/teaching-planner`, `components/Dashboard/TeachingProgressCard.tsx`.
- **Database**: `teaching_plans` (see [06](06-database.md) §6.3.8).
- **Relationships**: Optionally links to `course_materials`/`assignments`; realtime-pushed via `TEACHING_PLAN_CHANGED`.

## 8.15 Mentorship

- **Purpose**: Student-faculty mentorship — both a legacy 1:1 model and the current group-based model with an auto-balancing allocator.
- **Workflow**: Mentoring Head (or Admin) creates mentor groups by year/semester/section, either via range/section rules or manual roster (`mentor_group_students`); `suggestBalancedGroups` computes an even student-per-mentor distribution respecting `mentorship_settings` (recommended/maximum students per mentor, cross-department policy); faculty log mentoring notes per student; students/admin/mentoring-head view dashboards and reports.
- **Backend**: `mentorship.routes/controller/service.ts` (notes, dashboard, workloads, reports), `mentorGroup.routes/controller/service.ts` (group CRUD, suggest/merge/split/check-conflicts), `mentorshipSettings.routes/controller/service.ts`, `middleware/mentorshipAuth.ts` (record-level auth, §7.5.4).
- **Frontend**: `app/faculty/mentorship/[groupId]/[studentId]`, `app/student/mentorship`, `app/hod/mentorship` (mentoring-head desk), `app/admin/mentorship`.
- **Database**: `mentor_assignments` (legacy), `mentoring_notes`, `mentor_groups`, `mentor_group_students`, `mentorship_settings` (see [06](06-database.md) §6.3.7).
- **Relationships**: Reads Students/Faculty/Departments; a `mentor.assigned` Workflow trigger event exists for automated notification.

## 8.16 Feedback

- **Purpose**: Anonymous feedback campaigns (faculty/course/LMS/ERP-satisfaction types) with a template→question→campaign→response→answer pipeline.
- **Workflow**: Admin builds a reusable template (questions: rating/mcq/text/boolean) → creates a campaign ("window") targeting specific departments/semesters/sections/subjects/faculty (array-typed targeting columns) → previews eligibility → publishes → students submit (deduped via `feedback_submission_tracking`, answers stored **without** a student-identifying FK for anonymity) → admin/faculty view aggregated analytics → close/archive.
- **Backend**: `feedback.routes/controller/service.ts` (includes legacy path aliases: `/active-windows`, `/windows` kept working alongside the newer `/campaigns` naming).
- **Frontend**: `app/student/feedback/submit` (`FeedbackWizard.tsx`), `app/admin/feedback` (`CampaignManager.tsx`, `FeedbackTemplatesManager.tsx`), `app/hod/feedback`, `app/faculty/feedback`.
- **Database**: `feedback_windows`, `feedback_templates`, `feedback_questions`, `feedback_submission_tracking`, `feedback_responses`, `feedback_answers` (see [06](06-database.md) §6.3.9).
- **Relationships**: A `feedback.published` Workflow trigger notifies relevant faculty/students.

## 8.17 Opportunity Hub

- **Purpose**: Placement/internship/workshop/hackathon/event postings visible to students, with department/year-eligibility filtering and bookmarking.
- **Backend**: `opportunityHub.routes/controller/service.ts`.
- **Frontend**: `app/student/opportunities/[id]`/`bookmarks`, `app/admin/opportunities`, `app/faculty/opportunities`, `OpportunityCard.tsx`/`OpportunityFilterBar.tsx`/`OpportunityFormModal.tsx`.
- **Database**: `opportunities`, `opportunity_bookmarks` (see [06](06-database.md) §6.3.6).
- **Relationships**: Feeds Notifications (new-opportunity alerts) and the personal Calendar feed (`calendar_entries.source_module='opportunity'`).
- **Future improvements**: this is the closest analog to the planning docs' aspirational "Placement Module" — company/interview-round tracking, resume management, and eligibility-based auto-shortlisting are **not implemented**; it is a generic posting board, not a placement-drive workflow engine.

## 8.18 Notifications & Announcements

- **Purpose**: Two related but distinct communication channels — `notifications` (system-generated, per-user or broadcast, driven largely by the Workflow Engine) and `announcements` (admin-authored, broader audience targeting with Draft/Published/Expired lifecycle).
- **Backend**: `notification.routes/controller/service.ts`, `announcement.routes/controller/service.ts`.
- **Frontend**: `NotificationCenter.tsx` (shared inbox component), `TopHeader.tsx`'s bell dropdown, `app/*/announcements` and `app/*/notifications` per role.
- **Database**: `notifications`, `notification_reads`, `announcements` (see [06](06-database.md) #17, #26–27).
- **Relationships**: Realtime-pushed via `NOTIFICATION_EMITTED` Socket.IO event with client-side recipient matching (by userId/role/department/semester — see [04-frontend.md](04-frontend.md) §4.6).

## 8.19 Academic Calendar & Document Parsing

- **Purpose**: A distinctive pipeline that extracts calendar events from an uploaded academic-calendar PDF using rule-based text parsing, rather than manual entry.
- **Workflow**: Admin uploads a PDF (`uploadPdf` → `documents` table, `pdf-parse` extracts raw text) → `parsedEvent.controller.extractFromDocument` runs `utils/calendarExtractor.ts` (regex date parsing across multiple formats, event-type/audience classification, dedup) → produces `parsed_events` rows in `Pending` status → admin reviews/edits/approves/rejects each candidate → `publishEvents` promotes approved candidates into live `academic_calendar_events` (one-to-one via a unique FK, `Published`/`Updated`/`Archived` lifecycle).
- **Backend**: `document.routes/controller/service.ts`, `parsedEvent.routes/controller/service.ts`, `academicCalendar.routes/controller/service.ts`, `utils/calendarExtractor.ts`.
- **Frontend**: `app/admin/calendar` (`CalendarView.tsx`, `EventFormModal.tsx`), also surfaced read-only across `app/*/calendar` for other roles.
- **Database**: `documents`, `parsed_events`, `academic_calendar_events` (see [06](06-database.md) §6.3.6).
- **Relationships**: Distinct from `calendar_entries` (personal/aggregated calendar feed, §8.18-adjacent) — the Academic Calendar is institutional/official, `calendar_entries` is a personal aggregation of many event sources (assignments, opportunities, announcements, academic-calendar events, exam-seating room bookings) into one feed per user.

## 8.20 Academic Data Import

- **Purpose**: Bulk onboarding via spreadsheet, avoiding manual data entry for hundreds/thousands of student records at once.
- **Workflow**: Upload → preview (validate, classify create/update/duplicate/invalid rows, compute distributions) → commit (chunked, single-transaction, Merge-or-Replace mode) — see [05-backend.md](05-backend.md) §5.15 for the generic pipeline architecture.
- **Backend**: `academicImport.routes/controller/service.ts`, `studentSync.service.ts` (a separate "Nominal Rolls" workbook-sync flow specific to the sample data format seen in `I SEMESTER ROLL LIST WITH FULL DATA.xlsx`), the generic `backend/src/import/` framework.
- **Frontend**: `app/admin/import` (wizard UI).
- **Database**: `import_jobs` (job/audit tracking).
- ⚠ **Note**: only the Student entity-type importer is actually implemented; Faculty/Subjects/Curriculum/Teaching-Assignment/Department/Classroom/Timetable/Exam-Schedule importers are modeled in the `import_entity_type` enum and `ImportStrategy` interface but throw `IMPORT_STRATEGY_NOT_IMPLEMENTED` if invoked.

## 8.21 Workflow Rule Engine

- **Purpose**: Lets a Super Admin configure event-driven automation ("when X happens, do Y") without a code change — e.g. "when marks are published, notify students" or "when a lesson is rescheduled, create a calendar event."
- **Workflow**: Super Admin defines a rule (`trigger_event`, JSON `condition` array ANDed together, one-or-more `actions`) → a domain event fires (e.g. `attendance.marked`, `fee.paid`, `exam.completed`) → `workflowEngine.service.ts` evaluates matching active rules → executes actions (`notify_students`, `create_calendar_event`, `log_only`, `create_result_entry_task`) → logs the outcome (success/failed/retrying) to `workflow_logs`.
- **Backend**: `workflowRule.routes/controller/service.ts` (CRUD, `requireSuperAdmin()`-gated), `workflowEngine.service.ts` (execution + audit).
- **Frontend**: `app/admin/workflows`, `app/faculty/workflows` (read-only log view via Faculty Operations' `/workflow-logs`).
- **Database**: `workflow_rules`, `workflow_logs` (see [06](06-database.md) #41–42).
- **Relationships**: This is the closest analog to the planning docs' "Approval Workflow Framework" (`ARCHITECT_REVIEW.md` §4) — it is event-driven automation, not a maker-checker approval queue; **Result Entry Tasks (§8.11) is the only module with a genuine maker-checker approval chain** (submit → verify → publish, with distinct actor roles).

## 8.22 Analytics, Reports, Dashboards & Experience

- **Purpose**: Cross-module read aggregation for KPI dashboards (per-role), ad hoc analytics (attendance/results/fees/LMS/mentorship/teaching/opportunities/department), and a personalized "Experience" timeline+actions layer for students/faculty.
- **Backend**: `dashboard.routes/controller/service.ts` (+`dashboardAggregator.service.ts`), `analytics.routes/controller/service.ts`, `report.routes/controller/service.ts` (the widest single controller — 17 endpoints including PDF/Excel/CSV exports), `experience.routes/controller/service.ts` (+`experienceDashboard.service.ts`, `timelineEngine.service.ts`, `actionEngine.service.ts` — the latter is a pure rules layer with no DB access of its own).
- **Frontend**: Every role's `dashboard`/`analytics`/`reports` pages; `components/Dashboard/*`, `components/Analytics/*` (Recharts-based).
- **Database**: Reads across nearly every table in the schema — no dedicated tables of its own (pure read-model composition), with `utils/ttlCache.ts` memoizing expensive aggregations.
- **Relationships**: This module is the widest fan-in in the entire system (see [11-business-logic-and-sync-matrix.md](11-business-logic-and-sync-matrix.md) synchronization matrix).

## 8.23 Global Search

- **Purpose**: A single search bar (`Cmd/Ctrl+K`) returning role-scoped categorized results (students/faculty/subjects/announcements/events).
- **Backend**: `search.routes/controller/service.ts` — admin gets full results; faculty gets assigned students/subjects + scoped announcements/events; student gets subjects + scoped announcements/events.
- **Frontend**: `components/Search/GlobalSearch.tsx`, mounted in `TopHeader.tsx`.
- **Database**: Read-only across `students`, `faculty`, `subjects`, `announcements`, `academic_calendar_events`, `exams`, `exam_rooms`, `results`, `notifications`, `departments`, `subject_curriculum_mappings`, `teaching_assignments`.
