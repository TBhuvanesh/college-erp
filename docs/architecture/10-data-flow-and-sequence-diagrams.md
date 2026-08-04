# 10. Data Flow Diagrams & Sequence Diagrams

← [Back to Index](00-INDEX.md)

## 10.1 Student Registration → Dashboard Data Flow

```mermaid
flowchart LR
    A["Admin fills Add-Student form\nor bulk-imports Excel"] --> B["POST /students\nor /academic-import/student/commit"]
    B --> C["student.service.createStudent\n(or studentImport strategy)"]
    C --> D["INSERT users (role=student)\nINSERT students (dept/program/semester/section)"]
    D --> E[("students table")]
    E --> F["Realtime: no direct push here\n(picked up on next dashboard fetch)"]
    E --> G["Student logs in → GET /students/me,\n/dashboard/student, /attendance/summary,\n/results/my-results, /fees/my-fees"]
    G --> H["Student Dashboard renders\nAttendance %, Fee dues, Recent grades"]
```

## 10.2 Attendance Flow

```mermaid
flowchart TD
    TA["Teaching Assignment exists\n(faculty ↔ subject ↔ section)"] --> Roster["Faculty: GET /attendance/roster"]
    Roster --> Mark["Faculty: POST /attendance/sessions\n(upsert per student per date)"]
    Mark --> DB[("attendance table\nUNIQUE(student,subject,date)")]
    DB --> EventBus["eventBus.publish('ATTENDANCE_UPDATED')"]
    EventBus --> Socket["Socket.IO → subscribed clients"]
    Socket --> StudentPortal["Student Portal:\nuseRealtimeSync invalidates\nattendance queries"]
    DB --> Reports["Reports/Analytics:\nGET /reports/attendance,\nGET /analytics/*"]
    DB --> Dashboard["Dashboards:\nadmin/faculty/hod/student\naggregate attendance %"]
```

⚠ Note: the planning docs' "Attendance → Teaching Assignment → Attendance → Student Portal → Reports" flow implies a feedback loop through Teaching Assignment; in the actual implementation, Teaching Assignment is purely upstream (defines who *can* mark attendance for which section) — attendance data does not feed back into modifying teaching assignments.

## 10.3 Timetable Flow

```mermaid
flowchart TD
    Admin["Admin: creates timetable shell\n(department/program/year/semester/section, working_days)"] --> Slots["Admin: defines timetable_slots\n(TEACHING/BREAK/LUNCH, sequence)"]
    Slots --> Entries["Admin: creates timetable_entries\n(day_of_week × subject × class_type)"]
    Entries --> Link["Links entries to slots (timetable_entry_slots)\nand faculty (timetable_entry_faculty)"]
    Link --> Validate["POST /timetables/validate-input"]
    Validate --> Publish["POST /timetables/:id/publish\n(status: draft→validated→published)"]
    Publish --> EventBus["eventBus / Socket.IO push"]
    EventBus --> FacultyView["Faculty: GET /timetables/faculty/schedule"]
    EventBus --> StudentView["Student: GET /timetables/student/active"]
    Publish --> Notif["Workflow Engine may fire a notification\n(no dedicated timetable.published trigger currently defined)"]
```

## 10.4 Result Flow

```mermaid
flowchart TD
    Exam["Exam scheduled & conducted\n(exams table, status→Completed)"] --> Task["result_entry_tasks row created\nper (exam, teaching_assignment)"]
    Task --> Draft["Faculty: POST /results/tasks/:taskId/draft\n(saves draft marks)"]
    Draft --> Submit["Faculty: submitTaskForApproval\n(status → submitted_for_approval)"]
    Submit --> Verify["Verifier: verifyResultEntryTask\n(status → verified)"]
    Verify --> Grade["config/grading.ts: computeGrade()/computeResultStatus()\napplied to internal+external marks"]
    Grade --> Publish["Admin: POST /results/publish\n(bulk, by subject+section)\nresults.publication_status: Draft→Published"]
    Publish --> WF["Workflow Engine: marks.published trigger\n→ notify_students action"]
    WF --> StudentPortal["Student: GET /results/my-results"]
    Publish --> Reports["Reports/Analytics: GET /reports/results"]
```

## 10.5 Login / Refresh Data Flow (see also §10.6 sequence diagram)

```mermaid
flowchart LR
    Login["POST /auth/login"] --> Issue["issueTokenPair()\naccess(15m, JSON body) + refresh(7d, httpOnly cookie)"]
    Issue --> RT[("refresh_tokens\nsha256(token) stored")]
    Access["Client uses access token\nfor 15 min"] --> Expire["401 on expiry"]
    Expire --> Refresh["POST /auth/refresh\n(cookie only)"]
    Refresh --> Rotate["Verify hash in RT table\n→ revoke old, issue new pair"]
    Rotate --> Issue
```

---

## 10.6 Sequence Diagrams

### 10.6.1 Login

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as Express
    participant SV as auth.service
    participant DB as PostgreSQL
    U->>FE: submits email+password
    FE->>API: POST /auth/login {email,password}
    API->>API: authLimiter, validate(loginSchema)
    API->>SV: login(email,password)
    SV->>DB: SELECT users WHERE email=$1
    SV->>SV: bcrypt.compare (timing-safe even on miss)
    SV->>DB: SELECT faculty/students JOIN departments (role profile)
    SV->>SV: sign access(15m) + refresh(7d) JWT
    SV->>DB: INSERT refresh_tokens(hash)
    SV->>DB: UPDATE users.last_login
    SV-->>API: {accessToken, user}
    API->>DB: auditLog('LOGIN')
    API-->>FE: Set-Cookie erp_refresh_token (httpOnly) + {accessToken,user}
    FE->>FE: AuthContext stores user+token in memory,\nlocalStorage flag erp_has_session=true
    FE->>FE: redirect by role → /admin|/faculty|/hod|/student|/accountant/dashboard
```

### 10.6.2 Attendance Marking

```mermaid
sequenceDiagram
    actor F as Faculty
    participant FE as Faculty Attendance Page
    participant API as Express
    participant SV as attendance.service
    participant DB as PostgreSQL
    participant EB as eventBus/Socket.IO
    F->>FE: opens today's class
    FE->>API: GET /attendance/roster?teachingAssignmentId=...
    API->>SV: getRoster()
    SV->>DB: SELECT students via teaching_assignment_id
    DB-->>FE: roster list
    F->>FE: marks Present/Absent per student, taps Submit
    FE->>API: POST /attendance/sessions {records:[...]}
    API->>API: authenticate, requireRole('faculty'), validate
    API->>SV: markAttendance(records)
    SV->>DB: withTransaction: UPSERT attendance rows\n(UNIQUE student+subject+date)
    DB-->>SV: commit
    SV->>EB: publish('ATTENDANCE_UPDATED', {subjectId, section, date})
    EB-->>FE: (other connected clients) realtime_event
    SV-->>API: success
    API-->>FE: {success:true}
    FE-->>F: "Attendance Logged" confirmation
```

### 10.6.3 Results (Entry → Verify → Publish)

```mermaid
sequenceDiagram
    actor F as Faculty
    actor V as Verifier (Admin/HOD-scoped)
    actor A as Admin
    participant API as Express
    participant SV as result.service / resultEntryTask.service
    participant DB as PostgreSQL
    F->>API: POST /results/tasks/:taskId/draft {marks}
    API->>SV: saveDraftForTask()
    SV->>DB: UPSERT results (Draft), result_entry_tasks.status=draft_saved
    F->>API: POST /results/tasks/:taskId/submit
    API->>SV: submitTaskForApproval()
    SV->>DB: result_entry_tasks.status=submitted_for_approval, submitted_at=NOW()
    V->>API: POST /result-entry-tasks/:id/verify
    API->>SV: verifyResultEntryTask()
    SV->>DB: result_entry_tasks.status=verified
    A->>API: POST /results/publish {subjectId, section}
    API->>SV: publishResults()
    SV->>DB: UPDATE results SET publication_status='Published', published_at=NOW()\nWHERE subject_id=... AND section=... AND publication_status='Draft'
    SV->>DB: result_entry_tasks.status=published
    SV-->>API: count published
    Note over SV,DB: Workflow Engine trigger 'marks.published' fires\nfrom within the transaction's event queue
```

### 10.6.4 Timetable Publishing

```mermaid
sequenceDiagram
    actor A as Admin
    participant API as Express
    participant SV as timetable.service
    participant DB as PostgreSQL
    A->>API: POST /timetables {dept,program,year,semester,section,working_days}
    API->>SV: create()
    SV->>DB: INSERT timetables (status=draft)
    A->>API: (multiple) creates timetable_entries + links slots/faculty
    A->>API: POST /timetables/validate-input
    API->>SV: validateInput() — structural checks
    A->>API: POST /timetables/:id/publish
    API->>SV: publish()
    SV->>DB: UPDATE timetables SET status='published'
    SV-->>API: published timetable
    API-->>A: success
    Note over API: Faculty/Student clients subsequently GET\n/timetables/faculty/schedule or /student/active
```

### 10.6.5 Teaching Assignment Creation & Transfer

```mermaid
sequenceDiagram
    actor A as Admin
    participant API as Express
    participant SV as teachingAssignment.service
    participant DB as PostgreSQL
    A->>API: POST /teaching-assignments {facultyId, subjectId, section, academicYear}
    API->>SV: createTeachingAssignment()
    SV->>DB: validate against subject_curriculum_mappings
    SV->>DB: INSERT teaching_assignments\n(partial unique idx blocks a 2nd active owner for subject+year+section)
    Note over A,DB: Later — faculty resigns/on leave
    A->>API: POST /teaching-assignments/:id/transfer {newFacultyId, reason}
    API->>SV: transferTeachingAssignment()
    SV->>DB: withTransaction:\n1) old row: removed_by, removal_reason, is_active=false\n2) INSERT new teaching_assignments row for newFacultyId
    SV-->>API: new assignment
    Note over SV: Downstream attendance/marks/exams/materials keep their\noriginal teaching_assignment_id (historical FK), new activity\nuses the new assignment id
```

### 10.6.6 Subject/Curriculum Allocation (Bulk Excel Import)

```mermaid
sequenceDiagram
    actor A as Admin
    participant FE as SubjectCatalogManager
    participant API as Express
    participant SV as subjectImport.service
    participant DB as PostgreSQL
    A->>FE: drags in Excel/CSV file
    FE->>API: POST /subjects/import/preview (multipart, memory storage)
    API->>SV: parse rows, fuzzy department match, validate constraints
    SV-->>FE: preview {validRows, invalidRows, distributions}
    A->>FE: reviews preview, confirms
    FE->>API: POST /subjects/import (commit)
    API->>SV: importCommit()
    SV->>DB: withTransaction: chunked INSERT/UPDATE subjects\n+ subject_curriculum_mappings
    SV-->>API: {created, updated, skipped}
    API-->>FE: summary + downloadable error report
```

### 10.6.7 Student Registration (Bulk Import via Academic Import Engine)

```mermaid
sequenceDiagram
    actor A as Admin
    participant FE as Import Wizard
    participant API as Express
    participant Pipe as ValidationPipeline / studentImport.strategy
    participant TM as ImportTransactionManager
    participant DB as PostgreSQL
    A->>FE: uploads roll-list spreadsheet
    FE->>API: POST /academic-import/student/preview (multipart, 15MB)
    API->>Pipe: parse → validate headers → validateRows()
    Pipe-->>FE: ImportSummary {total, valid, invalid, duplicate, toCreate, toUpdate}
    A->>FE: reviews, chooses Merge or Replace mode, confirms
    FE->>API: POST /academic-import/student/commit {mode}
    API->>TM: commitInChunks() — chunks of 500 rows
    TM->>DB: withTransaction (single transaction for entire job):\n[Replace mode: delete impacted rows first]\nINSERT/UPDATE users+students per chunk
    DB-->>TM: commit (all-or-nothing across all chunks)
    TM->>DB: INSERT import_jobs (status=completed, counts)
    TM-->>API: job summary
    API-->>FE: {createdCount, updatedCount, jobId}
```

### 10.6.8 Mentorship Assignment (Auto-Balanced Groups)

```mermaid
sequenceDiagram
    actor MH as Mentoring Head
    participant API as Express
    participant SV as mentorGroup.service
    participant DB as PostgreSQL
    MH->>API: GET /mentor-groups/candidates?department&semester
    API->>SV: listMentorCandidates()
    SV->>DB: SELECT eligible faculty + unassigned students
    MH->>API: GET /mentor-groups/suggest
    API->>SV: suggestBalancedGroups()
    SV->>DB: reads mentorship_settings (recommended/max per mentor)
    SV->>SV: computes BalancedGroupsResult (even distribution)
    SV-->>API: suggested groups
    MH->>API: POST /mentor-groups/check-conflicts {groups}
    API->>SV: checkConflicts() — detects double-assignment
    MH->>API: POST /mentor-groups {finalized groups}
    API->>SV: createGroup() (repeated per group, or bulk)
    SV->>DB: INSERT mentor_groups + mentor_group_students (if manual method)
    Note over SV,DB: Workflow trigger 'mentor.assigned' may fire a notification
```

### 10.6.9 Notification Delivery

```mermaid
sequenceDiagram
    participant Trigger as Domain event\n(e.g. marks.published, fee.paid, mentor.assigned)
    participant WF as workflowEngine.service
    participant DB as PostgreSQL
    participant EB as eventBus / Socket.IO
    participant FE as Any connected client
    Trigger->>WF: event fires (inside withTransaction, queued until commit)
    WF->>DB: SELECT workflow_rules WHERE trigger_event=$1 AND is_active
    WF->>WF: evaluate JSON condition array (ANDed)
    WF->>DB: INSERT notifications (per matched rule's notify_students action)
    WF->>DB: INSERT workflow_logs (status=success/failed/retrying)
    DB-->>EB: (after commit) eventBus.publish('NOTIFICATION_EMITTED', payload)
    EB-->>FE: Socket.IO push
    FE->>FE: useRealtimeSync matches recipient (userId/role/department/semester)\n→ invalidates ["notifications"] query, fires newRealtimeNotification event
    FE->>FE: TopHeader bell badge updates, NotificationCenter list refreshes
```
