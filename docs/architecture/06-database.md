# 6. Database Documentation

← [Back to Index](00-INDEX.md)

**Engine**: PostgreSQL (Neon serverless in practice). **Schema history**: 50 sequential numbered migrations (`backend/src/db/migrations/001_*.sql` → `050_timetable_management.sql`), tracked in a `schema_migrations(version, applied_at)` table maintained by `backend/src/db/migrate.ts`. This document describes the **final schema state after all 50 migrations**, not any single migration in isolation.

## 6.1 Global Conventions

- Every table's primary key is `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` (extension `uuid-ossp`).
- Most tables have `created_at`/`updated_at TIMESTAMPTZ DEFAULT NOW()`, maintained by a per-table trigger `trg_<table>_updated_at` calling the shared function `fn_set_updated_at()`.
- Most tables have a soft-delete column `deleted_at TIMESTAMPTZ` (`NULL` = live row). **Soft delete is not universal** — see §6.5.
- `ALTER TYPE ... ADD VALUE` cannot run inside the same transaction that uses the new value (a Postgres restriction); `migrate.ts` special-cases migrations 020, 021, 026, 031, 039, 042, 044, 045, 046, 049 to run outside a transaction for this reason — an operational detail worth knowing before hand-writing new migrations.

## 6.2 Enum Types

| Enum | Introduced | Final value set |
|---|---|---|
| `user_role` | 001 (+021) | admin, faculty, student, accountant |
| `student_status` | 002 | active, graduated, suspended, inactive |
| `faculty_designation` | 003 (+020) | professor, associate_professor, assistant_professor, lecturer, hod |
| `faculty_status` | 003 | active, on_leave, resigned, retired |
| `subject_type` | 004 (+044) | core, elective, lab, project, seminar *(⚠ the `subjects.type` column was widened to `VARCHAR(50)` in migration 035 and is no longer bound to this enum — free-text values like "mandatory"/"workshop" are now allowed)* |
| `subject_status` | 004 | active, inactive, archived |
| `attendance_status` | 006 | present, absent |
| `assessment_type` | 007 | Assignment, Mid-1, Mid-2, Lab, Internal |
| `exam_type` | 008 (+039) | Mid-1, Mid-2, Lab Exam, Internal, End Semester, Internal Assessment, Semester End Examination, Practical/Laboratory Exam, Viva, Improvement Exam, Supplementary Exam |
| `exam_status` | 008 (+045) | Scheduled, Ongoing, Completed, Cancelled, Scripts Distributed, Archived |
| `result_grade` | 009 | O, A+, A, B+, B, C, F |
| `result_status` | 009 | Pass, Fail, Absent |
| `result_pub_status` | 009 | Draft, Published |
| `fee_type` | 010 | Tuition Fee, Examination Fee, Laboratory Fee, Miscellaneous Fee |
| `payment_status` | 010 | Pending, Partially Paid, Paid, Overdue |
| `fee_payment_mode` | 010 | Cash, DD, Cheque, Online |
| `announcement_audience` | 011 | All, Students, Faculty, Admin, Department Specific, Semester Specific |
| `announcement_priority` | 011 | Low, Medium, High, Urgent |
| `announcement_status` | 011 | Draft, Published, Expired |
| `document_type` | 013 | Academic Calendar |
| `document_status` | 013 | Uploaded, Processed |
| `parsed_event_type` | 014 | Class Commencement, Mid-Term Examination, End Semester Examination, Lab Examination, Internal Assessment, Holiday, Supplementary Examination, Academic Activity, Other |
| `parsed_event_audience` | 014 | All, Students, Faculty, I/II/III/IV Year |
| `parsed_event_status` | 014 | Pending, Approved, Edited, Rejected |
| `cal_publish_status` | 015 | Published, Updated, Archived |
| `lms_file_type` | 017 | pdf, ppt, pptx, doc, docx |
| `submission_status` | 017 | Submitted, Late Submission, Evaluated |
| `opportunity_type` | 018 | Internship, Job Opportunity, Workshop, Seminar, Hackathon, Competition, Placement Drive, College Event |
| `opportunity_status` | 018 | Active, Closed, Archived |
| `notification_type` | 019 | Announcement, Assignment, Grade Released, Event, Internship, Job Opportunity, Placement Drive, Reminder, Academic Alert |
| `calendar_event_type` | 019 | Academic, Assignment Deadline, Examination, Opportunity, Reminder, Meeting, Other |
| `calendar_visibility` | 019 | personal, department, semester, faculty, student, institution_wide |
| `mentor_assignment_status` | 023 | active, reassigned, completed |
| `mentor_assignment_method` | 024 | range, section, manual |
| `lesson_completion_status` | 025 (+026) | Planned, Completed, Rescheduled, Cancelled, In Progress, Partially Completed |
| `feedback_type_enum` | 027 | faculty, course, lms, erp |
| `question_type_enum` | 027 | rating, mcq, text, boolean |
| `workflow_trigger_event` | 028 (+031,+042,+046,+049) | material.created, assignment.created, lesson.completed, lesson.rescheduled, quiz.published, exam_seating.published, exam.completed, teaching_assignment.created, student_import.completed, attendance.marked, marks.published, feedback.published, mentor.assigned, fee.paid |
| `workflow_action_type` | 028 (+042) | notify_students, create_calendar_event, log_only, create_result_entry_task |
| `workflow_log_status` | 028 | success, failed, retrying |
| `invigilation_status` | 029 | Assigned, Completed, Cancelled |
| `bench_type_enum` | 030 | single, double, triple |
| `seating_pattern_type` | 030 | mid, semester, random, custom |
| `exam_session_status` | 030 (+031) | draft, generated, published, archived, validated, completed *(backs `exam_sessions` only — see §6.6 note 1)* |
| `campaign_status_enum` | 033 | draft, published, open, closed, archived |
| `result_entry_task_status` | 042 (+045) | open, draft_saved, submitted_for_approval, verified, published, closed |
| `import_entity_type` | 046 | student, faculty, subject, curriculum, teaching_assignment, department, classroom, timetable, examination_schedule |
| `import_job_status` | 046 | previewed, committing, completed, failed, rolled_back |
| `import_mode` | 048 | merge, replace |

**Fixed value-sets not backed by an enum** (VARCHAR + CHECK): `teaching_assignments.status` ('active'/'inactive'/'pending'), `examination_sessions.status` (VARCHAR(30), app-enforced only), `timetables.status` ('draft'/'validated'/'published'/'archived'), `timetable_slots.slot_type` ('TEACHING'/'BREAK'/'LUNCH'), `timetable_entries.day_of_week`, `timetable_entries.class_type`, `notifications.target_role`, and `*.academic_year` columns (regex `^\d{4}-\d{4}$`).

## 6.3 Entity-Relationship Diagrams

Given 60 tables, the ER model is presented as several domain-scoped diagrams rather than one unreadable diagram.

### 6.3.1 Core Identity & Organization

```mermaid
erDiagram
    USERS ||--o| STUDENTS : "user_id"
    USERS ||--o| FACULTY : "user_id"
    USERS ||--o| ACCOUNTANTS : "user_id"
    USERS ||--o{ REFRESH_TOKENS : "user_id"
    USERS ||--o{ AUDIT_LOGS : "actor_id"
    DEPARTMENTS ||--o{ PROGRAMS : "department_id"
    DEPARTMENTS ||--o{ STUDENTS : "department_id"
    DEPARTMENTS ||--o{ FACULTY : "department_id"
    PROGRAMS ||--o{ STUDENTS : "program_id"

    USERS { uuid id PK }
    STUDENTS { uuid id PK, uuid user_id FK, varchar roll_number UK, uuid department_id FK, uuid program_id FK, smallint semester, varchar academic_year }
    FACULTY { uuid id PK, uuid user_id FK, varchar employee_number UK, uuid department_id FK, enum designation, bool is_mentoring_head }
    ACCOUNTANTS { uuid id PK, uuid user_id FK, varchar employee_number UK }
    DEPARTMENTS { uuid id PK, varchar name UK, varchar code UK }
    PROGRAMS { uuid id PK, uuid department_id FK, varchar code UK }
```

`faculty` additionally enforces **one HOD per department** via a partial unique index: `idx_unique_hod_per_dept ON faculty(department_id) WHERE designation='hod' AND deleted_at IS NULL`.

### 6.3.2 Subjects, Curriculum, Teaching Assignment

```mermaid
erDiagram
    SUBJECTS ||--o{ SUBJECT_CURRICULUM_MAPPINGS : "subject_id"
    DEPARTMENTS ||--o{ SUBJECT_CURRICULUM_MAPPINGS : "department_id"
    PROGRAMS ||--o{ SUBJECT_CURRICULUM_MAPPINGS : "program_id (SET NULL)"
    SUBJECT_CURRICULUM_MAPPINGS ||--o{ TEACHING_ASSIGNMENTS : "subject_curriculum_mapping_id"
    FACULTY ||--o{ TEACHING_ASSIGNMENTS : "faculty_id"
    SUBJECTS ||--o{ TEACHING_ASSIGNMENTS : "subject_id"
    DEPARTMENTS ||--o{ TEACHING_ASSIGNMENTS : "department_id"

    SUBJECTS { uuid id PK, varchar code UK, varchar name, smallint semester, numeric credits, varchar type }
    SUBJECT_CURRICULUM_MAPPINGS { uuid id PK, uuid subject_id FK, uuid department_id FK, uuid program_id FK, varchar regulation, varchar year, smallint semester }
    TEACHING_ASSIGNMENTS { uuid id PK, uuid faculty_id FK, uuid subject_id FK, uuid subject_curriculum_mapping_id FK, varchar academic_year, varchar section, varchar status }
```

⚠ **Historical note**: `subjects` originally carried `department_id/program_id/program/regulation/year/semester_raw` directly (migrations 004→035); migration 038 moved all of that into `subject_curriculum_mappings`, leaving `subjects` with only `semester` plus catalog fields (credits, L/T/P hours, description, abbreviation). `faculty_subject_assignments` was renamed to `teaching_assignments` in migration 041, with a read-only compatibility **VIEW** kept under the old name so legacy queries still work.

`teaching_assignments` is the hub for nearly every academic transaction table — `attendance`, `internal_marks`, `exams`, `teaching_plans`, `course_materials`, `assignments`, `result_entry_tasks`, and `results` all carry a nullable `teaching_assignment_id` FK (added in migrations 042/043) in addition to their original direct `subject_id`/`faculty_id` FKs (kept for backward compatibility and denormalized query speed).

### 6.3.3 Attendance, Marks, Examinations, Results

```mermaid
erDiagram
    STUDENTS ||--o{ ATTENDANCE : "student_id"
    FACULTY ||--o{ ATTENDANCE : "faculty_id"
    SUBJECTS ||--o{ ATTENDANCE : "subject_id"
    TEACHING_ASSIGNMENTS ||--o{ ATTENDANCE : "teaching_assignment_id"

    STUDENTS ||--o{ INTERNAL_MARKS : "student_id"
    SUBJECTS ||--o{ INTERNAL_MARKS : "subject_id"

    SUBJECTS ||--o{ EXAMS : "subject_id"
    EXAMINATION_SESSIONS ||--o{ EXAMS : "session_id (CASCADE)"
    EXAM_SESSIONS ||--o{ EXAM_SESSION_EXAMS : "exam_session_id"
    EXAMS ||--o{ EXAM_SESSION_EXAMS : "exam_id"

    STUDENTS ||--o{ RESULTS : "student_id"
    SUBJECTS ||--o{ RESULTS : "subject_id"
    EXAMS ||--o{ RESULTS : "exam_id (nullable)"
    FACULTY ||--o{ RESULTS : "faculty_id"

    EXAMS ||--o{ RESULT_ENTRY_TASKS : "exam_id"
    TEACHING_ASSIGNMENTS ||--o{ RESULT_ENTRY_TASKS : "teaching_assignment_id"

    ATTENDANCE { uuid id PK, uuid student_id FK, date attendance_date, enum status }
    INTERNAL_MARKS { uuid id PK, uuid student_id FK, enum assessment_type, numeric obtained_marks }
    EXAMS { uuid id PK, uuid subject_id FK, uuid session_id FK, enum exam_type, enum status }
    RESULTS { uuid id PK, uuid student_id FK, uuid exam_id FK, enum grade, enum result_status, enum publication_status }
    RESULT_ENTRY_TASKS { uuid id PK, uuid exam_id FK, uuid teaching_assignment_id FK, enum status }
```

`attendance`, `internal_marks`, and `fee_payments` are **append-only ledgers with no `deleted_at`** — corrections happen via `UPDATE`, not soft-delete, preserving a single row per (student, subject, date)/(student, subject, assessment_type) unique constraint.

### 6.3.4 Fees

```mermaid
erDiagram
    STUDENTS ||--o{ FEES : "student_id"
    FEES ||--o{ FEE_PAYMENTS : "fee_id"
    USERS ||--o{ FEE_PAYMENTS : "recorded_by"

    FEES { uuid id PK, uuid student_id FK, enum fee_type, numeric total_amount, numeric paid_amount, numeric pending_amount, enum payment_status }
    FEE_PAYMENTS { uuid id PK, uuid fee_id FK, numeric amount, enum payment_mode, uuid recorded_by FK }
```

`fees` enforces `pending_amount = total_amount - paid_amount` and `paid_amount <= total_amount` via CHECK constraints — the database itself guarantees the "financial bounds" invariant described in the planning docs.

### 6.3.5 LMS

```mermaid
erDiagram
    SUBJECTS ||--o{ COURSE_MATERIALS : "subject_id"
    FACULTY ||--o{ COURSE_MATERIALS : "faculty_id"
    SUBJECTS ||--o{ ASSIGNMENTS : "subject_id"
    FACULTY ||--o{ ASSIGNMENTS : "faculty_id"
    ASSIGNMENTS ||--o{ ASSIGNMENT_SUBMISSIONS : "assignment_id"
    STUDENTS ||--o{ ASSIGNMENT_SUBMISSIONS : "student_id"

    COURSE_MATERIALS { uuid id PK, uuid subject_id FK, enum file_type, text file_path }
    ASSIGNMENTS { uuid id PK, uuid subject_id FK, timestamptz due_date, numeric max_marks }
    ASSIGNMENT_SUBMISSIONS { uuid id PK, uuid assignment_id FK, uuid student_id FK, enum status, numeric marks }
```

`assignment_submissions` has a unique partial index `(assignment_id, student_id) WHERE deleted_at IS NULL` — one active submission per student per assignment (resubmission soft-deletes the prior row).

### 6.3.6 Opportunity Hub, Notifications, Calendar

```mermaid
erDiagram
    DEPARTMENTS ||--o{ OPPORTUNITIES : "department_id (nullable)"
    OPPORTUNITIES ||--o{ OPPORTUNITY_BOOKMARKS : "opportunity_id"
    STUDENTS ||--o{ OPPORTUNITY_BOOKMARKS : "student_id"

    NOTIFICATIONS ||--o{ NOTIFICATION_READS : "notification_id"
    USERS ||--o{ NOTIFICATION_READS : "user_id"

    USERS ||--o{ DOCUMENTS : "uploaded_by"
    DOCUMENTS ||--o{ PARSED_EVENTS : "document_id"
    PARSED_EVENTS ||--o| ACADEMIC_CALENDAR_EVENTS : "parsed_event_id (unique FK)"
    DOCUMENTS ||--o{ ACADEMIC_CALENDAR_EVENTS : "source_document_id"

    OPPORTUNITIES { uuid id PK, enum type, uuid department_id FK, text[] eligible_years, enum status }
    OPPORTUNITY_BOOKMARKS { uuid id PK, uuid opportunity_id FK, uuid student_id FK }
    NOTIFICATIONS { uuid id PK, enum type, uuid recipient_user_id FK, varchar target_role }
    NOTIFICATION_READS { uuid id PK, uuid notification_id FK, uuid user_id FK }
    DOCUMENTS { uuid id PK, text file_path UK, enum status }
    PARSED_EVENTS { uuid id PK, uuid document_id FK, enum event_type, enum status }
    ACADEMIC_CALENDAR_EVENTS { uuid id PK, uuid parsed_event_id FK, enum publish_status }
```

`opportunity_bookmarks` and `notification_reads` are the two true **many-to-many join tables** in the schema (students↔opportunities, users↔notifications), both hard-delete-toggle (no `deleted_at`).

### 6.3.7 Mentorship

```mermaid
erDiagram
    FACULTY ||--o{ MENTOR_ASSIGNMENTS : "mentor_id (legacy 1:1)"
    STUDENTS ||--o{ MENTOR_ASSIGNMENTS : "student_id"
    FACULTY ||--o{ MENTORING_NOTES : "mentor_id"
    STUDENTS ||--o{ MENTORING_NOTES : "student_id"
    FACULTY ||--o{ MENTOR_GROUPS : "mentor_id"
    DEPARTMENTS ||--o{ MENTOR_GROUPS : "department_id"
    MENTOR_GROUPS ||--o{ MENTOR_GROUP_STUDENTS : "mentor_group_id"
    STUDENTS ||--o{ MENTOR_GROUP_STUDENTS : "student_id"

    MENTOR_ASSIGNMENTS { uuid id PK, uuid mentor_id FK, uuid student_id FK, enum status }
    MENTORING_NOTES { uuid id PK, uuid mentor_id FK, uuid student_id FK, date meeting_date }
    MENTOR_GROUPS { uuid id PK, uuid mentor_id FK, uuid department_id FK, enum assignment_method }
    MENTOR_GROUP_STUDENTS { uuid id PK, uuid mentor_group_id FK, uuid student_id FK }
```

`mentor_assignments` (legacy 1:1 model, migration 023) is superseded in practice by the group-based `mentor_groups`/`mentor_group_students` model (migration 024) but the table remains for backward compatibility. `idx_unique_active_mentee` enforces one active 1:1 mentor per student under the legacy model.

### 6.3.8 Teaching Plans (Lesson Progress Engine)

```mermaid
erDiagram
    FACULTY ||--o{ TEACHING_PLANS : "faculty_id"
    SUBJECTS ||--o{ TEACHING_PLANS : "subject_id"
    COURSE_MATERIALS ||--o{ TEACHING_PLANS : "material_id (nullable)"
    ASSIGNMENTS ||--o{ TEACHING_PLANS : "assignment_id (nullable)"
    TEACHING_PLANS ||--o{ TEACHING_PLANS : "parent_lesson_id (self-ref, continuations)"

    TEACHING_PLANS { uuid id PK, uuid faculty_id FK, uuid subject_id FK, smallint week_number, enum lesson_status, smallint lesson_sequence, uuid parent_lesson_id FK }
```

A unique partial index `(subject_id, section, semester, lesson_sequence) WHERE deleted_at IS NULL` enforces strict lesson ordering per class.

### 6.3.9 Feedback Campaigns

```mermaid
erDiagram
    FEEDBACK_TEMPLATES ||--o{ FEEDBACK_WINDOWS : "template_id"
    FEEDBACK_TEMPLATES ||--o{ FEEDBACK_QUESTIONS : "template_id (CASCADE)"
    FEEDBACK_WINDOWS ||--o{ FEEDBACK_SUBMISSION_TRACKING : "window_id (CASCADE)"
    FEEDBACK_WINDOWS ||--o{ FEEDBACK_RESPONSES : "window_id (CASCADE)"
    FEEDBACK_RESPONSES ||--o{ FEEDBACK_ANSWERS : "response_id (CASCADE)"
    FEEDBACK_QUESTIONS ||--o{ FEEDBACK_ANSWERS : "question_id"

    FEEDBACK_WINDOWS { uuid id PK, enum status, uuid[] target_department_ids, smallint[] target_semesters }
    FEEDBACK_TEMPLATES { uuid id PK, enum type }
    FEEDBACK_QUESTIONS { uuid id PK, uuid template_id FK, enum type, jsonb options }
    FEEDBACK_SUBMISSION_TRACKING { uuid id PK, uuid window_id FK, uuid student_id FK, uuid subject_id FK }
    FEEDBACK_RESPONSES { uuid id PK, uuid window_id FK, uuid faculty_id FK, uuid subject_id FK }
    FEEDBACK_ANSWERS { uuid id PK, uuid response_id FK, uuid question_id FK, int rating_value, text text_value }
```

Deliberate anonymity design: `feedback_responses`/`feedback_answers` carry **no `student_id`** — only `feedback_submission_tracking` links a student to a window (for one-submission-per-window dedup), while the actual answers are unlinkable back to the submitter.

### 6.3.10 Examination Seating, Invigilation, Rooms & Sessions

```mermaid
erDiagram
    EXAM_ROOMS ||--o{ EXAM_SEAT_ALLOCATIONS : "room_id"
    EXAMS ||--o{ EXAM_SEAT_ALLOCATIONS : "exam_id"
    STUDENTS ||--o{ EXAM_SEAT_ALLOCATIONS : "student_id"
    EXAM_ROOMS ||--o{ EXAM_INVIGILATION_DUTIES : "room_id"
    FACULTY ||--o{ EXAM_INVIGILATION_DUTIES : "faculty_id"
    SEATING_PATTERNS ||--o{ EXAM_SESSIONS : "seating_pattern_id"
    EXAM_SESSIONS ||--o{ EXAM_SESSION_EXAMS : "exam_session_id"

    EXAM_ROOMS { uuid id PK, varchar name UK, smallint capacity, enum bench_type }
    EXAM_SEAT_ALLOCATIONS { uuid id PK, uuid exam_id FK, uuid room_id FK, uuid student_id FK, smallint seat_number, bool is_locked }
    EXAM_INVIGILATION_DUTIES { uuid id PK, uuid room_id FK, uuid faculty_id FK, date duty_date, enum status }
    SEATING_PATTERNS { uuid id PK, enum pattern_type, uuid[] department_sequence }
    EXAM_SESSIONS { uuid id PK, enum status, uuid seating_pattern_id FK }
```

⚠ **Two distinct "session" concepts that read similarly but are different tables** — do not conflate them:
- `exam_sessions` (migration 030) is an **orchestration/config record** for bulk seating+invigilation generation across many exams at once; it joins to `exams` via the `exam_session_exams` many-to-many table, and its `status` uses the `exam_session_status` enum.
- `examination_sessions` (migration 040) is a **scheduling-batch container** that individual `exams` rows reference directly via `exams.session_id` (`ON DELETE CASCADE`). Its `status` is a plain `VARCHAR(30)`, not tied to any enum.

### 6.3.11 Timetable

```mermaid
erDiagram
    DEPARTMENTS ||--o{ TIMETABLES : "department_id (CASCADE)"
    PROGRAMS ||--o{ TIMETABLES : "program_id (SET NULL)"
    TIMETABLES ||--o{ TIMETABLE_SLOTS : "timetable_id (CASCADE)"
    TIMETABLES ||--o{ TIMETABLE_ENTRIES : "timetable_id (CASCADE)"
    SUBJECTS ||--o{ TIMETABLE_ENTRIES : "subject_id (CASCADE)"
    TIMETABLE_ENTRIES ||--o{ TIMETABLE_ENTRY_SLOTS : "entry_id"
    TIMETABLE_SLOTS ||--o{ TIMETABLE_ENTRY_SLOTS : "slot_id"
    TIMETABLE_ENTRIES ||--o{ TIMETABLE_ENTRY_FACULTY : "entry_id"
    FACULTY ||--o{ TIMETABLE_ENTRY_FACULTY : "faculty_id"

    TIMETABLES { uuid id PK, varchar academic_year, uuid department_id FK, varchar status, int version }
    TIMETABLE_SLOTS { uuid id PK, uuid timetable_id FK, time start_time, varchar slot_type }
    TIMETABLE_ENTRIES { uuid id PK, uuid timetable_id FK, uuid subject_id FK, varchar day_of_week, varchar class_type }
    TIMETABLE_ENTRY_SLOTS { uuid entry_id FK, uuid slot_id FK }
    TIMETABLE_ENTRY_FACULTY { uuid entry_id FK, uuid faculty_id FK }
```

`timetable_entry_slots` (supports merged/double periods) and `timetable_entry_faculty` (supports co-teaching) are both composite-PK many-to-many join tables — the newest module (migration 050) in the schema.

## 6.4 Full Table Inventory (60 tables + 1 view)

| # | Table | Domain | Key columns beyond id/timestamps | PK/Unique highlights |
|---|---|---|---|---|
| 1 | `users` | Identity | email UK, password_hash, role, is_active, is_super_admin, phone_number, last_login | partial idx on email where live |
| 2 | `refresh_tokens` | Identity | user_id FK, token_hash UK, expires_at, revoked_at | reuse-detection model, see [07](07-authentication-and-security.md) |
| 3 | `audit_logs` | Identity | actor_id FK, action, resource, resource_id, changes JSONB, ip_address INET | append-only |
| 4 | `departments` | Org | name UK, code UK, color | |
| 5 | `programs` | Org | department_id FK, code UK, total_semesters | UNIQUE(department_id, name) |
| 6 | `students` | Org | user_id UK FK, roll_number UK, department_id/program_id FK, semester, section, academic_year, status, mobile_number, gender, father_name, mother_name | composite partial idx (program_id, semester) for active students |
| 7 | `faculty` | Org | user_id UK FK, employee_number UK, department_id FK, designation, status, is_mentoring_head | partial unique: one HOD/department |
| 8 | `subjects` | Curriculum | code UK, name, semester, credits (NUMERIC 3,1), type (VARCHAR), lecture/tutorial/practical_hours, abbreviation | column relocation history, see §6.3.2 |
| 9 | `subject_curriculum_mappings` | Curriculum | subject_id FK (CASCADE), department_id FK, program_id FK (SET NULL), regulation, year, semester | UNIQUE(subject_id, department_id, program, regulation, year, semester) |
| 10 | `teaching_assignments` (renamed from `faculty_subject_assignments`) | Teaching | faculty_id/subject_id FK, academic_year, section, status, department_id, weekly_teaching_hours | UNIQUE(faculty_id, subject_id, academic_year, section); partial unique one-active-faculty-per-section |
| 11 | `attendance` | Academic ledger | student_id/faculty_id/subject_id FK, section, attendance_date, status, teaching_assignment_id | UNIQUE(student_id, subject_id, attendance_date); **no deleted_at** |
| 12 | `internal_marks` | Academic ledger | student_id/faculty_id/subject_id FK, assessment_type, maximum_marks, obtained_marks | UNIQUE(student_id, subject_id, assessment_type); **no deleted_at** |
| 13 | `exams` | Examination | subject_id FK, faculty_id FK (nullable), exam_type, exam_date/start/end (nullable), max_marks, status, session_id FK (CASCADE) | partial unique no-duplicate-active-exam |
| 14 | `results` | Examination | student_id/subject_id FK, exam_id FK (nullable), internal/external marks + max, total, grade, result_status, publication_status | UNIQUE(student_id, subject_id); 3 CHECKs incl. total=internal+external |
| 15 | `fees` | Finance | student_id FK, academic_year, semester, fee_type, total/paid/pending_amount, due_date, payment_status | 2 CHECKs enforce financial bounds |
| 16 | `fee_payments` | Finance ledger | fee_id FK, amount, payment_date, payment_mode, transaction_ref, recorded_by FK | append-only, no updated_at/deleted_at |
| 17 | `announcements` | Communication | title, content, target_audience, department_id (conditional), semester (conditional), priority, publish/expiry_date, status, created_by FK | 3 CHECKs enforce audience-field consistency |
| 18 | `documents` | Calendar pipeline | title, file_name, file_path UK, document_type, extracted_text, uploaded_by FK, status | |
| 19 | `parsed_events` | Calendar pipeline | document_id FK, title, start/end_date, event_type, target_audience, department_id, status | |
| 20 | `academic_calendar_events` | Calendar pipeline | parsed_event_id UK FK, source_document_id FK, publish_status, is_edited, created_by FK | unique partial: one live event per candidate |
| 21 | `course_materials` | LMS | title, subject_id/faculty_id FK, file_name/path UK, file_type, file_size, teaching_assignment_id | |
| 22 | `assignments` | LMS | title, subject_id/faculty_id FK, due_date, max_marks, teaching_assignment_id | |
| 23 | `assignment_submissions` | LMS | assignment_id/student_id FK, file_name/path UK, status, marks, feedback, submitted_at | unique partial: one active submission per (assignment, student) |
| 24 | `opportunities` | Placement | title, type, department_id (nullable=all), eligible_years TEXT[], deadline, status, created_by FK | CHECK date ordering; GIN idx on eligible_years |
| 25 | `opportunity_bookmarks` | Placement | opportunity_id/student_id FK | many-to-many join, unique pair |
| 26 | `notifications` | Communication | title, message, type, source_module/source_id (no FK), target_role, department_id, recipient_user_id FK | **no updated_at** |
| 27 | `notification_reads` | Communication | notification_id FK (CASCADE), user_id FK (CASCADE), read_at | many-to-many join, unique pair |
| 28 | `calendar_entries` | Calendar | title, event_type, start/end_date, visibility, source_module/source_id, department_id, room_id FK, created_by FK | unique partial on (source_module, source_id) |
| 29 | `accountants` | Org | user_id UK FK, employee_number UK, avatar_url | |
| 30 | `mentor_assignments` | Mentorship (legacy) | mentor_id/student_id FK, assigned_by FK, status | partial unique: one active mentee row |
| 31 | `mentoring_notes` | Mentorship | mentor_id/student_id FK, title, remarks, meeting_date, follow_up_date | |
| 32 | `mentor_groups` | Mentorship | mentor_id FK, department_id FK, year, semester, section, assignment_method, roll_number_start/end, created_by FK | |
| 33 | `mentor_group_students` | Mentorship | mentor_group_id FK (CASCADE), student_id FK (CASCADE) | many-to-many join |
| 34 | `teaching_plans` | Teaching | faculty_id/subject_id/department_id FK, year, semester, section, week_number, lesson_date, topic_title, material_id/assignment_id FK (nullable), lesson_status, lesson_sequence, parent_lesson_id (self-ref), teaching_assignment_id | unique partial on lesson sequence per class |
| 35 | `feedback_windows` | Feedback | title, academic_year, status (enum), template_id FK, target_department_ids/semesters/sections/subject_ids/faculty_ids arrays, published_at | |
| 36 | `feedback_templates` | Feedback | title, type, is_active | |
| 37 | `feedback_questions` | Feedback | template_id FK (CASCADE), text, type, options JSONB, order_index, is_required | |
| 38 | `feedback_submission_tracking` | Feedback | window_id FK (CASCADE), student_id FK (CASCADE), subject_id FK (CASCADE, nullable), feedback_type | UNIQUE(window,student,subject,type) — dedup only, no answer linkage |
| 39 | `feedback_responses` | Feedback | window_id/template_id FK, subject_id/faculty_id FK (CASCADE) | **anonymous — no student_id** |
| 40 | `feedback_answers` | Feedback | response_id FK (CASCADE), question_id FK, rating_value, text_value | |
| 41 | `workflow_rules` | Automation | name, trigger_event, condition JSONB, actions[] (CHECK non-empty), is_active, created_by FK | |
| 42 | `workflow_logs` | Automation | workflow_name, trigger_event, rule_id FK, action, actor_id FK, payload JSONB, status, retry_count | append-only |
| 43 | `exam_rooms` | Exam infra | name UK, building, capacity, floor, room_number, rows, columns, bench_type, under_maintenance | |
| 44 | `exam_seat_allocations` | Exam infra | exam_id/room_id/student_id FK, seat_number, bench_number, seat_position, is_locked, exam_session_id FK | 2 unique partial indexes (no double-booking) |
| 45 | `exam_invigilation_duties` | Exam infra | room_id/faculty_id FK, duty_date, start/end_time, status, assigned_by FK | unique partial: no double-assignment |
| 46 | `seating_patterns` | Exam infra | name, pattern_type, department_sequence UUID[], is_default, created_by FK | |
| 47 | `exam_sessions` | Exam infra | name, exam_type, department_ids[]/years[]/sections[]/exam_dates[]/subject_ids[]/classroom_ids[]/invigilator_ids[] arrays, seating_pattern_id FK, status | see §6.3.10 note |
| 48 | `exam_session_exams` | Exam infra | exam_session_id/exam_id FK | many-to-many join |
| 49 | `mentorship_settings` | Config | recommended/maximum_students_per_mentor, allow_cross_department, updated_by FK | single global row (not PK-enforced singleton) |
| 50 | `examination_sessions` | Exam infra | academic_year, regulation, department_id FK, year, semester, exam_type, sections[]/subject_ids[], status (VARCHAR) | see §6.3.10 note |
| 51 | `result_entry_tasks` | Examination | exam_id/teaching_assignment_id/faculty_id FK, status, window_opens/closes_at, submitted/published_at | UNIQUE(exam_id, teaching_assignment_id) |
| 52 | `teaching_assignment_backfill_exceptions` | Migration audit | source_table, source_id, faculty_id/subject_id (informational, no FK), reason | one-time migration audit table |
| 53 | `teaching_load_settings` | Config | theory/lab/tutorial_weight, min/max_weekly_load, min/max_subjects_per_faculty, auto_marks_window_days, require_result_verification | **true singleton** — `id SMALLINT PK DEFAULT 1 CHECK(id=1)` |
| 54 | `import_jobs` | Import engine | entity_type, status, file_name, total/valid/invalid/duplicate_rows, created/updated_count, mode, summary JSONB, created_by FK | |
| 55 | `timetables` | Timetable | academic_year, department_id FK (CASCADE), program_id FK (SET NULL), year, semester, section, status, working_days[], version, effective_from | |
| 56 | `timetable_slots` | Timetable | timetable_id FK (CASCADE), start/end_time, slot_type, sequence_order | no soft delete |
| 57 | `timetable_entries` | Timetable | timetable_id FK (CASCADE), day_of_week, subject_id FK (CASCADE), class_type | no soft delete |
| 58 | `timetable_entry_slots` | Timetable | entry_id/slot_id FK (both CASCADE) | composite PK join |
| 59 | `timetable_entry_faculty` | Timetable | entry_id FK (CASCADE), faculty_id FK (CASCADE) | composite PK join |
| 60 | `schema_migrations` | Meta | version PK, applied_at | maintained by `migrate.ts`, not a `.sql` file |
| — | `faculty_subject_assignments` (VIEW) | Compat | `SELECT * FROM teaching_assignments` | read-only backward-compat shim |

## 6.5 Soft Delete — Where It Applies and Where It Doesn't

Soft delete (`deleted_at`) is the default convention, but is **deliberately omitted** on immutable/ledger tables where a correction should be a new row or an in-place `UPDATE`, not a delete: `attendance`, `internal_marks`, `fee_payments`, `notifications` (has `deleted_at` but no `updated_at`), `opportunity_bookmarks`, `exam_seat_allocations` (has `deleted_at` but no `updated_at` — regeneration soft-deletes prior allocations), `timetable_slots`, `timetable_entries`, `workflow_logs`, `import_jobs`, `teaching_load_settings`, `mentorship_settings`. This matches the "audit-first, append where possible" philosophy documented in `BUSINESS_RULES_AND_WORKFLOWS.md`.

## 6.6 Normalization & Design Notes

1. **Denormalization by explicit design** (documented in SQL comments): `exams.semester` duplicates `subjects.semester` for query speed; `teaching_plans.department_id/year/semester` duplicate the subject/curriculum placement; `results.internal_max_marks`/`external_max_marks` are stored per-row rather than derived from `subjects`, so historical grading-scheme changes don't retroactively alter published results.
2. **Column relocation**: curriculum-placement columns moved from `subjects` to `subject_curriculum_mappings` (migration 038) once it became clear a subject can be taught under multiple department/program/regulation/year/semester combinations — a genuine normalization improvement made mid-project.
3. **Rename with compatibility shim**: `faculty_subject_assignments` → `teaching_assignments` (migration 041), old name preserved as a VIEW.
4. **Singleton config tables**: `teaching_load_settings` (DB-enforced via `CHECK(id=1)`), `mentorship_settings` (convention-only, not DB-enforced).
5. **Two similarly-named but distinct entities**: `exam_sessions` vs. `examination_sessions` — see §6.3.10. Any new work on exam scheduling should first determine which of the two a given feature actually needs.
6. **Un-typed cross-module references**: `notifications.source_module`/`source_id`, `calendar_entries.source_module`/`source_id`, and `seating_patterns.department_sequence` (a UUID array with no DB-level FK) are intentional "soft" references — the application layer, not the database, guarantees referential integrity for these. This trades DB-enforced consistency for schema flexibility across many source modules.

Full relationship-by-relationship listing (for anyone building a complete ER tool import) is embedded in the per-domain diagrams in §6.3; the domain groupings above are exhaustive across all 60 tables.
