# 9. API Documentation

← [Back to Index](00-INDEX.md)

All endpoints are mounted under `/api`. This document lists every route file, every endpoint, its middleware chain, and the controller function that handles it. For request/response body shapes, see the Zod schemas in `backend/src/types/*.ts` (referenced by name where relevant) — this document focuses on the *surface* (method/path/auth/purpose), since request/response payloads mirror the database columns documented in [06-database.md](06-database.md).

## 9.0 Conventions Used Throughout

- **`auth`** = the `authenticate` middleware (valid JWT required).
- **Role names** in `requireRole(...)` are literal: `admin`, `faculty`, `student`, `accountant`.
- **`authorize('resource:action')`** = fine-grained permission-matrix check (see [07](07-authentication-and-security.md) §7.5.2).
- **`validate({...})`** = Zod schema validation on body/params/query.
- **Response envelope**: success → `{success:true, data, message?, metadata?}`; error → `{success:false, code, message}` (see [05-backend.md](05-backend.md) §5.9).
- **Pagination**: most list endpoints accept `page`/`limit` query params (default page=1/limit=20, observed max 100), each with its own Zod schema (e.g. `listStudentsQuerySchema`).
- **File uploads**: marked **(file upload)**. **Export/download** endpoints marked accordingly.
- Static/literal path segments (`/me`, `/export`, `/count`, `/:id/status`) are always declared before generic `/:id` routes to avoid Express param-shadowing — a consistent convention across every route file.

---

## 9.1 Auth — `/api/auth`

| Method | Path | Middleware | Handler |
|---|---|---|---|
| POST | `/login` | `authLimiter`, validate(email+password) | `login` |
| POST | `/refresh` | none (reads refresh cookie) | `refresh` |
| POST | `/logout` | none (reads refresh cookie) | `logout` |
| POST | `/logout-all` | auth | `logoutAll` |
| GET | `/me` | auth | `me` (always re-fetches live from DB) |

## 9.2 Reference Example — `/api/example`

Not business logic — `protected.routes.ts` demonstrates the 6 auth patterns (public / authenticated / `requireRole('admin')` / `requireRole('admin','faculty')` / `authorize('attendance:create')` / `requireRole('student')`) as a template for new routes.

## 9.3 Departments — `/api/departments`

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `listDepartments` |
| GET | `/:id` | auth, validate(uuid) | `getDepartment` |
| GET | `/programs/list` | auth, validate(query: departmentId?) | `listPrograms` |
| GET | `/programs/:id` | auth, validate(uuid) | `getProgram` |
| PUT | `/:id/color` | auth, `requireRole('admin')`, validate | `updateDepartmentColor` |

## 9.4 Students — `/api/students`

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/me` | auth, `requireRole('student')` | `getMyProfile` |
| POST | `/` | auth, admin, validate(createStudentSchema) | `createStudent` |
| PATCH | `/:id` | auth, admin, validate | `updateStudent` |
| PATCH | `/:id/status` | auth, admin, validate | `updateStudentStatus` |
| DELETE | `/:id` | auth, admin, validate(uuid) | `deleteStudent` (soft) |
| GET | `/` | auth, `requireRole('admin','faculty','accountant')`, validate(pagination+filters) | `listStudents` |
| GET | `/sections` | auth, `requireRole('admin','faculty')` | `listSections` (distinct active dept+semester sections — source of truth for Mentorship) |
| GET | `/:id` | auth, validate(uuid) | `getStudent` (own-record check in controller) |

## 9.5 Faculty — `/api/faculty` & Faculty Operations — `/api/faculty-operations`

**faculty.routes.ts**

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/me` | auth, `requireRole('faculty')` | `getMyProfile` |
| POST | `/` | auth, admin, validate | `createFaculty` |
| PATCH | `/:id` | auth, admin, validate | `updateFaculty` |
| PATCH | `/:id/status` | auth, admin, validate | `updateFacultyStatus` |
| DELETE | `/:id` | auth, admin, validate(uuid) | `deleteFaculty` |
| GET | `/` | auth, `requireRole('admin','faculty')` | `listFaculty` |
| GET | `/:id` | auth, `requireRole('admin','faculty')`, validate(uuid) | `getFaculty` |

**facultyOperations.routes.ts** (all `authenticate` first)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/dashboard` | `requireRole('faculty')` | `getDashboard` |
| GET | `/tasks` | `requireRole('faculty')` | `getTasks` |
| GET | `/workload` | `requireRole('admin','faculty')`, validate(query) | `getWorkload` |
| GET | `/workflow-logs` | `requireRole('admin','faculty')`, validate(query) | `getWorkflowLogsHandler` |
| GET | `/analytics` | `requireRole('admin','faculty')`, validate(query) | `getAnalytics` |

## 9.6 Subjects & Curriculum — `/api/subjects`

All routes behind `authenticate`.

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | admin/faculty, validate(query) | `listSubjects` |
| GET | `/export` | admin/faculty | `exportSubjects` **(export)** |
| GET | `/:id` | admin/faculty, validate(uuid) | `getSubject` |
| POST | `/` | admin, validate | `createSubject` |
| PUT | `/:id` | admin, validate | `updateSubject` |
| PATCH | `/:id/status` | admin, validate | `updateSubjectStatus` |
| DELETE | `/all/wipe` | admin | `deleteAllSubjects` (bulk wipe — declared before `/:id`) |
| DELETE | `/:id` | admin, validate(uuid) | `deleteSubject` |
| POST | `/import/preview` | admin, multer memory 10MB | `importPreview` **(file upload)** |
| POST | `/import` | admin | `importCommit` |
| POST | `/:id/mappings` | admin, validate | `createCurriculumMapping` |
| PATCH | `/mappings/:mappingId` | admin, validate | `updateCurriculumMapping` |
| DELETE | `/mappings/:mappingId` | admin, validate | `deleteCurriculumMapping` |

## 9.7 Teaching Assignment Family

**subjectAllocation.routes.ts** (`/api/subject-allocations`, **deprecated** back-compat alias — delegates 100% to `teachingAssignment.service.ts`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `listAllocations` |
| GET | `/statistics` | auth | `getStatistics` |
| GET | `/subject/:subjectId/profile` | auth | `getSubjectProfile` |
| GET | `/:id` | auth | `getAllocation` |
| POST | `/` | auth, admin | `createAllocation` |
| PUT | `/:id` | auth, admin | `updateAllocation` |
| POST | `/:id/transfer` | auth, admin | `transferAllocation` |
| DELETE | `/:id` | auth, admin | `deleteAllocation` |

**teachingAssignment.routes.ts** (`/api/teaching-assignments`, canonical)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `listTeachingAssignments` |
| GET | `/my` | auth | `getMyTeachingAssignments` |
| GET | `/statistics` | auth | `getStatistics` |
| GET | `/workload-overview` | auth | `getFacultyWorkloadOverview` |
| GET | `/subjects` | auth, validate(query) | `resolveSubjectsForAssignment` |
| GET | `/subject/:subjectId/profile` | auth | `getSubjectProfile` |
| GET | `/:id` | auth | `getTeachingAssignment` |
| POST | `/` | auth, admin | `createTeachingAssignment` |
| PUT | `/:id` | auth, admin | `updateTeachingAssignment` |
| POST | `/:id/transfer` | auth, admin | `transferTeachingAssignment` |
| DELETE | `/:id` | auth, admin | `deleteTeachingAssignment` |

**teachingPlan.routes.ts** (`/api/teaching-plans`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/student-roadmap` | auth, validate(query) | `getStudentRoadmap` |
| GET | `/today` | auth, validate(query) | `getTodayLessons` |
| GET | `/upcoming` | auth, validate(query: `view=week\|month\|semester`) | `getUpcomingLessons` |
| GET | `/progress` | auth, validate(query) | `getCourseProgress` |
| GET | `/` | auth, validate(pagination) | `listTeachingPlans` |
| GET | `/:id` | auth, validate(uuid) | `getTeachingPlan` |
| POST | `/` | auth, `requireRole('faculty')`, validate | `createTeachingPlan` |
| PUT | `/:id` | auth, faculty, validate | `updateTeachingPlan` |
| DELETE | `/:id` | auth, faculty, validate | `deleteTeachingPlan` |
| PUT | `/:id/status` | auth, faculty, validate | `updateLessonStatus` |
| PUT | `/:id/reschedule` | auth, faculty, validate | `rescheduleTeachingPlan` |
| PUT | `/:id/continue` | auth, faculty, validate | `continueLesson` (Auto Shift Engine) |

**teachingLoadSettings.routes.ts** (`/api/teaching-load-settings`, auth-only, no role gate)

| Method | Path | Handler |
|---|---|---|
| GET | `/` | `getSettings` |
| PUT | `/` | `updateSettings` |

**timetable.routes.ts** (`/api/timetables`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/student/active` | auth, `requireRole('student')` | `getStudentActive` |
| GET | `/faculty/schedule` | auth, `requireRole('faculty')` | `getFacultySchedule` |
| POST | `/` | auth, admin | `create` |
| GET | `/` | auth, `requireRole('admin','faculty','student')` | `list` |
| GET | `/:id` | auth | `getById` |
| PUT | `/:id` | auth, admin | `update` |
| DELETE | `/:id` | auth, admin | `remove` |
| POST | `/validate-input` | auth, admin | `validateInput` |
| POST | `/:id/publish` | auth, admin | `publish` |

## 9.8 Attendance — `/api/attendance`

| Method | Path | Middleware | Handler |
|---|---|---|---|
| POST | `/assignments` | auth, admin, validate | `createAssignment` |
| GET | `/assignments` | auth, admin, validate(query) | `listAssignments` |
| GET | `/assignments/:assignmentId` | auth, admin | `getAssignment` |
| DELETE | `/assignments/:assignmentId` | auth, admin | `deleteAssignment` |
| GET | `/my-assignments` | auth, `requireRole('faculty')` | `getMyAssignments` |
| GET | `/roster` | auth, faculty, validate(query) | `getRoster` |
| POST | `/sessions` | auth, faculty, validate | `markAttendance` (upsert) |
| GET | `/summary` | auth, `requireRole('student')` | `getStudentSummary` |
| GET | `/history` | auth, student, validate(query) | `getStudentHistory` |
| GET | `/` | auth, `requireRole('admin','faculty')`, validate(pagination) | `listAttendance` |
| GET | `/:id` | auth, admin/faculty | `getAttendance` |
| PATCH | `/:id` | auth, admin/faculty | `updateAttendance` |

## 9.9 Internal Marks & Results Family

**internal-marks.routes.ts** (`/api/internal-marks`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/roster` | auth, `requireRole('faculty')` | `getRoster` |
| POST | `/sessions` | auth, faculty, validate | `bulkEnterMarks` |
| GET | `/summary` | auth, `requireRole('student')` | `getStudentSummary` |
| GET | `/history` | auth, student | `getStudentHistory` |
| GET | `/` | auth, `requireRole('admin','faculty')` | `listMarks` |
| GET | `/:id` | auth, admin/faculty | `getMarks` |
| PATCH | `/:id` | auth, admin/faculty | `updateMarks` |

**result.routes.ts** (`/api/results`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/roster` | auth, `requireRole('faculty')` | `getRoster` |
| POST | `/sessions` | auth, faculty, validate | `bulkSubmitResults` |
| POST | `/tasks/:taskId/draft` | auth, faculty, validate | `saveDraftForTask` |
| POST | `/tasks/:taskId/publish` | auth, faculty, validate | `publishTask` |
| POST | `/publish` | auth, admin, validate | `publishResults` (bulk, by subject+section) |
| GET | `/my-results` | auth, `requireRole('student')` | `getMyResults` (`?semester=N`) |
| GET | `/` | auth, `requireRole('admin','faculty')`, validate(pagination) | `listResults` |
| GET | `/:id` | auth, admin/faculty | `getResult` |
| PATCH | `/:id` | auth, admin/faculty | `updateResult` (grade/status auto-recomputed) |
| DELETE | `/:id` | auth, admin | `deleteResult` (soft) |

**resultEntryTask.routes.ts** (`/api/result-entry-tasks`, auth-only, no route-level role gate — scoped in service)

| Method | Path | Handler |
|---|---|---|
| GET | `/` | `listMyResultEntryTasks` |
| GET | `/:id` | `getResultEntryTask` |
| POST | `/:id/submit` | `submitTaskForApproval` |
| POST | `/:id/verify` | `verifyResultEntryTask` |

## 9.10 Examination Family

**examination.routes.ts** (`/api/examinations`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/my-schedule` | auth, `requireRole('faculty')` | `getMySchedule` |
| GET | `/timetable` | auth, `requireRole('student')` | `getTimetable` |
| GET | `/upcoming` | auth, student | `getUpcomingExams` |
| GET | `/` | auth, `requireRole('admin','faculty')` | `listExams` |
| POST | `/` | auth, admin/faculty, validate | `createExam` |
| GET | `/sessions` | auth, admin/faculty | `listSessions` |
| POST | `/sessions` | auth, admin | `createSession` |
| GET | `/sessions/:id` | auth, admin/faculty | `getSession` |
| POST | `/sessions/:id/schedule-subject` | auth, admin | `configureSubjectSchedule` |
| POST | `/sessions/:id/publish` | auth, admin | `publishSession` |
| DELETE | `/sessions/:id` | auth, admin | `deleteSession` |
| GET | `/:id` | auth, `requireRole('admin','faculty','student')` | `getExam` |
| PATCH | `/:id` | auth, admin/faculty | `updateExam` |
| PATCH | `/:id/status` | auth, admin/faculty | `updateExamStatus` |
| DELETE | `/:id` | auth, admin | `deleteExam` (soft) |

**examRoom.routes.ts** (`/api/exam-rooms`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/availability` | auth, admin/faculty, validate(query) | `listRoomAvailability` |
| GET | `/suggest` | auth, admin/faculty | `suggestRooms` |
| GET | `/` | auth (all roles) | `listExamRooms` |
| GET | `/:id` | auth | `getExamRoom` |
| POST | `/` | auth, admin | `createExamRoom` |
| PUT | `/:id` | auth, admin | `updateExamRoom` |
| DELETE | `/:id` | auth, admin | `deleteExamRoom` |

**examSeating.routes.ts** (`/api/exam-seating`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/slots` | auth, admin/faculty | `getExamSlots` |
| POST | `/generate` | auth, admin/faculty | `generateSeating` (HOD scoped to own dept) |
| POST | `/check-conflicts` | auth, admin/faculty | `checkConflicts` (dry-run) |
| GET | `/search` | auth, admin/faculty | `searchSeating` (roll no/name/room/building/invigilator/bench) |
| GET | `/analytics` | auth, admin/faculty | `getSeatingAnalytics` |
| POST | `/swap` | auth, admin/faculty | `swapSeats` |
| POST | `/move` | auth, admin/faculty | `moveSeat` |
| PUT | `/:id/lock` | auth, admin/faculty | `lockSeat` |
| GET | `/me` | auth, `requireRole('student')` | `getMySeating` |
| GET | `/exam/:examId` | auth | `getSeatingByExam` |
| GET | `/room/:roomId` | auth | `getSeatingByRoom` (`?date=`) |

**examInvigilation.routes.ts** (`/api/exam-invigilation`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| POST | `/generate` | auth, admin/faculty | `generateInvigilation` |
| GET | `/suggest` | auth, admin/faculty | `suggestInvigilators` |
| GET | `/` | auth, admin/faculty | `listInvigilationDuties` |
| PUT | `/:id` | auth, admin/faculty | `updateInvigilationDuty` |

**examSession.routes.ts** (`/api/exam-sessions` — router-wide `authenticate, requireRole('admin','faculty')`; HOD scoping enforced in service)

| Method | Path | Handler |
|---|---|---|
| GET | `/` | `listExamSessions` |
| GET | `/:id` | `getExamSession` |
| POST | `/` | `createExamSession` |
| PUT | `/:id` | `updateExamSession` |
| DELETE | `/:id` | `deleteExamSession` |
| POST | `/:id/resolve-exams` | `resolveExams` |
| POST | `/:id/check-conflicts` | `checkConflicts` |
| POST | `/:id/generate-seating` | `generateSeating` |
| POST | `/:id/generate-invigilation` | `generateInvigilation` |
| POST | `/:id/validate` | `validateExamSession` |
| POST | `/:id/publish` | `publishExamSession` |
| POST | `/:id/complete` | `completeExamSession` |
| POST | `/:id/archive` | `archiveExamSession` |

**seatingPattern.routes.ts** (`/api/seating-patterns`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `listSeatingPatterns` |
| GET | `/:id` | auth | `getSeatingPattern` |
| POST | `/` | auth, admin | `createSeatingPattern` |
| PUT | `/:id` | auth, admin | `updateSeatingPattern` |
| DELETE | `/:id` | auth, admin | `deleteSeatingPattern` |

## 9.11 Academic Calendar / Calendar Entries / Parsed Events / Academic Import

**academicCalendar.routes.ts** (`/api/calendar`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| POST | `/publish` | auth, admin | `publishEvents` |
| GET | `/` | auth (role-scoped) | `listCalendarEvents` |
| PATCH | `/:id/status` | auth, admin | `updateCalendarEventStatus` |
| GET | `/:id` | auth | `getCalendarEvent` |
| PATCH | `/:id` | auth, admin | `updateCalendarEvent` |

**calendarEntry.routes.ts** (`/api/calendar-entries`, personal feed)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `listCalendarEntries` |
| POST | `/` | auth | `createCalendarEntry` |
| PUT | `/:id` | auth (creator or admin) | `updateCalendarEntry` |
| DELETE | `/:id` | auth (creator or admin) | `deleteCalendarEntry` |

**parsedEvent.routes.ts** (`/api/parsed-events`, router-wide admin-only)

| Method | Path | Handler |
|---|---|---|
| POST | `/extract/:documentId` | `extractFromDocument` |
| GET | `/` | `listParsedEvents` |
| PATCH | `/:id/status` | `updateParsedEventStatus` |
| GET | `/:id` | `getParsedEvent` |
| PATCH | `/:id` | `updateParsedEvent` (auto→Edited) |
| DELETE | `/:id` | `deleteParsedEvent` |

**academicImport.routes.ts** (`/api/academic-import`, admin-only)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/entity-types` | auth, admin | `listEntityTypes` |
| GET | `/jobs` | auth, admin | `listJobs` |
| GET | `/jobs/:jobId` | auth, admin | `getJob` |
| POST | `/student-sync/preview` | auth, admin, upload.single (15MB) | `previewStudentSync` **(file upload)** |
| POST | `/student-sync/commit` | auth, admin | `commitStudentSync` |
| GET | `/:entityType/replace-impact` | auth, admin | `replaceImpact` |
| POST | `/:entityType/preview` | auth, admin, upload.single (15MB) | `preview` **(file upload)** |
| POST | `/:entityType/commit` | auth, admin | `commit` |

## 9.12 Documents — `/api/documents` (router-wide admin-only)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| POST | `/upload` | `uploadPdf` (20MB, PDF only) | `uploadDocument` **(file upload)** |
| GET | `/` | validate(query) | `listDocuments` |
| GET | `/:id` | validate | `getDocument` (includes extracted text) |
| DELETE | `/:id` | validate | `deleteDocument` |

## 9.13 LMS Family

**material.routes.ts** (`/api/lms/materials`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `listMaterials` (role-scoped) |
| GET | `/:id/download` | auth | `downloadMaterial` **(download)** |
| GET | `/:id` | auth | `getMaterial` |
| POST | `/` | auth, `requireRole('faculty')`, `uploadLmsFile` | `createMaterial` **(file upload)** |
| PUT | `/:id` | auth, faculty, `uploadLmsFile` | `updateMaterial` (file optional) |
| DELETE | `/:id` | auth, faculty | `deleteMaterial` |

**lmsAssignment.routes.ts** (`/api/lms/assignments`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `listAssignments` |
| GET | `/:id` | auth | `getAssignment` |
| POST | `/` | auth, `requireRole('faculty')` | `createAssignment` |
| PUT | `/:id` | auth, faculty | `updateAssignment` |
| DELETE | `/:id` | auth, faculty | `deleteAssignment` |

**lmsSubmission.routes.ts** (`/api/lms/submissions`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `listSubmissions` |
| GET | `/:id/download` | auth | `downloadSubmission` **(download)** |
| GET | `/:id` | auth | `getSubmission` |
| POST | `/` | auth, `requireRole('student')`, `uploadLmsFile` | `submitAssignment` **(file upload)** |
| PUT | `/:id` | auth, `requireRole('faculty')` | `gradeSubmission` |

## 9.14 Opportunity Hub — `/api/opportunities`

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/bookmarks` | auth, `requireRole('student')`, validate(pagination) | `listBookmarks` |
| GET | `/` | auth (role-scoped) | `listOpportunities` |
| GET | `/:id` | auth | `getOpportunity` |
| POST | `/` | auth, `requireRole('admin','faculty')` | `createOpportunity` |
| PUT | `/:id` | auth, admin/faculty (ownership enforced in service) | `updateOpportunity` |
| DELETE | `/:id` | auth, admin | `deleteOpportunity` |
| POST | `/:id/bookmark` | auth, `requireRole('student')` | `toggleBookmark` |

## 9.15 Mentorship Family

**mentorship.routes.ts** (`/api/mentorship`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| POST | `/assign` | auth, `authorizeMentoringHead` | `assignMentor` |
| PUT | `/reassign` | auth, `authorizeMentoringHead` | `reassignMentor` |
| GET | `/mentor/:id` | auth, `authorizeMentorSelfOrHead` | `getStudentsByMentor` |
| GET | `/student/:id` | auth, `authorizeStudentMentorshipAccess('params','id')` | `getMentorByStudent` |
| GET | `/dashboard` | auth, `requireRole('faculty')` | `getMentorDashboard` |
| GET | `/workloads` | auth, `authorizeMentoringHead` | `getMentorWorkloads` |
| GET | `/reports` | auth, `authorizeMentoringHead` | `getMentorshipReports` |
| POST | `/notes` | auth, `authorizeStudentMentorshipAccess('body','studentId')` | `addNote` |
| PUT | `/notes/:id` | auth, `authorizeNoteAccess` | `updateNote` |
| DELETE | `/notes/:id` | auth, `authorizeNoteAccess` | `deleteNote` |
| GET | `/notes/student/:id` | auth, `authorizeStudentMentorshipAccess('params','id')` | `getNotesByStudent` |

**mentorGroup.routes.ts** (`/api/mentor-groups`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/suggest` | auth, `authorizeMentoringHead` | `suggestBalancedGroups` |
| GET | `/candidates` | auth, `authorizeMentoringHead` | `listMentorCandidates` |
| GET | `/` | auth | `getGroups` |
| GET | `/:id/students` | auth | `resolveStudents` |
| POST | `/check-conflicts` | auth, `authorizeMentoringHead` | `checkConflicts` |
| POST | `/merge` | auth, `authorizeMentoringHead` | `mergeGroups` |
| POST | `/` | auth, `authorizeMentoringHead` | `createGroup` |
| PUT | `/:id` | auth, `authorizeMentoringHead` | `updateGroup` |
| POST | `/:id/split` | auth, `authorizeMentoringHead` | `splitGroup` |
| DELETE | `/:id` | auth, `authorizeMentoringHead` | `deleteGroup` |

**mentorshipSettings.routes.ts** (`/api/mentorship-settings`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `getSettings` |
| PUT | `/` | auth, `requireRole('admin')` | `updateSettings` |

## 9.16 Fee / Accountant Family

**fee.routes.ts** (`/api/fees`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| POST | `/bulk` | auth, `requireRole('admin','accountant')` | `bulkCreateFees` |
| GET | `/my-fees` | auth, `requireRole('student')` | `getMyFees` |
| GET | `/my-dues` | auth, student | `getMyDues` |
| GET | `/` | auth, `requireRole('admin','accountant')` | `listFees` |
| POST | `/` | auth, admin/accountant | `createFee` |
| GET | `/:id` | auth, `requireRole('admin','student','accountant')` | `getFee` (student sees own only) |
| PATCH | `/:id` | auth, admin/accountant | `updateFee` |
| DELETE | `/:id` | auth, admin/accountant | `deleteFee` (only if no payments recorded) |
| POST | `/:id/payments` | auth, admin/accountant | `recordPayment` |
| GET | `/:id/payments` | auth, admin/student/accountant | `getFeePayments` |

**accountant.routes.ts** (`/api/accountants`, router-wide admin-only)

| Method | Path | Handler |
|---|---|---|
| POST | `/` | `createAccountant` |
| GET | `/` | `listAccountants` |
| GET | `/:id` | `getAccountant` |
| PATCH | `/:id` | `updateAccountant` |
| PATCH | `/:id/status` | `updateAccountantStatus` |
| DELETE | `/:id` | `deleteAccountant` |

## 9.17 Notifications / Announcements

**notification.routes.ts** (`/api/notifications`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/count` | auth | `getNotificationCount` |
| GET | `/` | auth (pagination + role-scoped) | `listNotifications` |
| POST | `/` | auth, `requireRole('admin','faculty')` | `createNotification` (faculty can target students only) |
| PUT | `/:id/read` | auth | `markAsRead` |
| PUT | `/:id/unread` | auth | `markAsUnread` |

**announcement.routes.ts** (`/api/announcements`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth, `requireRole('admin','faculty','student')` | `listAnnouncements` |
| POST | `/` | auth, admin | `createAnnouncement` (starts Draft) |
| PATCH | `/:id/status` | auth, admin | `updateAnnouncementStatus` |
| GET | `/:id` | auth | `getAnnouncement` |
| PATCH | `/:id` | auth, admin | `updateAnnouncement` (audience fields immutable) |
| DELETE | `/:id` | auth, admin | `deleteAnnouncement` |

## 9.18 Feedback — `/api/feedback`

| Method | Path | Middleware | Handler |
|---|---|---|---|
| POST | `/campaigns/preview-eligibility` | auth, admin | `previewEligibility` |
| GET | `/campaigns` | auth, admin/faculty | `listCampaigns` |
| POST | `/campaigns` | auth, admin | `createCampaign` |
| GET | `/campaigns/:id` | auth, admin/faculty | `getCampaign` |
| PUT | `/campaigns/:id` | auth, admin | `updateCampaign` |
| POST | `/campaigns/:id/publish` | auth, admin | `publishCampaign` |
| POST | `/campaigns/:id/close` | auth, admin | `closeCampaign` |
| POST | `/campaigns/:id/archive` | auth, admin | `archiveCampaign` |
| GET | `/my-campaigns` | auth, student | `getMyCampaigns` |
| POST | `/submit` | auth, student | `submitFeedback` |
| GET | `/my-submissions` | auth, student | `getMySubmissions` |
| GET | `/active-windows` | auth (legacy alias) | `getActiveWindows` |
| GET | `/windows` | auth, admin/faculty (legacy alias) | `listCampaigns` |
| POST | `/windows` | auth, admin (legacy alias) | `createCampaign` |
| GET | `/analytics` | auth, admin/faculty | `getAnalytics` |
| GET | `/templates` | auth | `getTemplates` |
| POST | `/templates` | auth, admin | `createTemplate` |
| PUT | `/templates/:id` | auth, admin | `updateTemplate` |
| POST | `/questions` | auth, admin | `createQuestion` |
| PUT | `/questions/:id` | auth, admin | `updateQuestion` |
| DELETE | `/questions/:id` | auth, admin | `deleteQuestion` |

## 9.19 Workflow Rule — `/api/workflow` (all `requireSuperAdmin()`)

| Method | Path | Handler |
|---|---|---|
| GET | `/rules` | `listWorkflowRules` |
| GET | `/rules/:id` | `getWorkflowRule` |
| POST | `/rules` | `createWorkflowRule` |
| PUT | `/rules/:id` | `updateWorkflowRule` |
| DELETE | `/rules/:id` | `deleteWorkflowRule` |

## 9.20 Experience / Dashboard / Analytics / Reports / Search / Profile

**experience.routes.ts** (`/api/experience`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/student` | auth, `requireRole('student')` | `getStudentExperience` |
| GET | `/student/timeline` | auth, student | `getStudentTimeline` |
| GET | `/student/actions` | auth, student | `getStudentActions` |
| GET | `/student/week` | auth, student | `getStudentWeek` |
| GET | `/faculty` | auth, `requireRole('faculty')` | `getFacultyExperience` |
| GET | `/faculty/timeline` | auth, faculty | `getFacultyTimeline` |
| GET | `/faculty/actions` | auth, faculty | `getFacultyActions` |
| GET | `/dashboard/widgets` | auth, `requireRole('admin','faculty','student')` | `getDashboardWidgets` |

**dashboard.routes.ts** (`/api/dashboard`, one endpoint per role)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/admin` | auth, `requireRole('admin')` | `adminDashboard` |
| GET | `/faculty` | auth, `requireRole('faculty')` | `facultyDashboard` |
| GET | `/hod` | auth, `requireRole('faculty')` (designation checked in service) | `hodDashboard` |
| GET | `/student` | auth, `requireRole('student')` | `studentDashboard` |
| GET | `/accountant` | auth, `requireRole('accountant')` | `accountantDashboard` |

**analytics.routes.ts** (`/api/analytics`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/admin` | auth, `requireRole('admin')` | `getAdminAnalytics` |
| GET | `/hod` | auth, `requireRole('faculty')` (designation enforced in service) | `getHodAnalytics` |
| GET | `/faculty` | auth, `requireRole('faculty')` | `getFacultyAnalytics` |
| GET | `/student` | auth, `requireRole('student')` | `getStudentAnalytics` |

**report.routes.ts** (`/api/reports`, 17 endpoints, `requireRole('admin','faculty')` unless noted)

| Method | Path | Handler |
|---|---|---|
| GET | `/attendance` | `getAttendanceReport` |
| GET | `/results` | `getResultsReport` |
| GET | `/fees` | `getFeesReport` |
| GET | `/lms` | `getLmsReport` |
| GET | `/mentorship` | `getMentorshipReport` |
| GET | `/department` | `getDepartmentReport` |
| GET | `/opportunities` | `getOpportunitiesReport` |
| GET | `/teaching` | `getTeachingReport` |
| GET | `/room-seating-chart` | `getRoomSeatingChartReport` |
| GET | `/student-seating-list` | `getStudentSeatingListReport` |
| GET | `/invigilator-sheet` | `getInvigilatorSheetReport` |
| GET | `/seating-attendance-sheet` | `getSeatingAttendanceSheetReport` |
| GET | `/seating-summary` | `getSeatingSummaryReport` |
| GET | `/student` (also `requireRole('student')`) | `getStudentReport` (student sees own only) |
| GET | `/export/pdf` | `exportPdf` **(export)** |
| GET | `/export/excel` | `exportExcel` **(export)** |
| GET | `/export/csv` | `exportCsv` **(export)** |

**search.routes.ts** (`/api/search`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth, validate(query: `q=`) | `globalSearch` (role-scoped) |

**profile.routes.ts** (`/api/profile`)

| Method | Path | Middleware | Handler |
|---|---|---|---|
| GET | `/` | auth | `getProfile` (role-specific shape) |
| PUT | `/` | auth | `updateProfile` (own account only) |
| PUT | `/change-password` | auth | `changePassword` (invalidates all sessions) |

## 9.21 Health Check

| Method | Path | Handler |
|---|---|---|
| GET | `/api/health` | Inline in `app.ts` — `{success:true, data:{status:'ok', timestamp}}`, no auth |

---

## 9.22 Cross-Cutting API Observations

1. **Deprecation pattern**: `/api/subject-allocations` is fully preserved for backward compatibility but is a zero-logic re-export of `teachingAssignment.service.ts` — a completed "strangler fig" migration at the service layer while the old route/controller shell remains for any client still calling it.
2. **File uploads** use one of 4 configurations: disk-based `uploadPdf` (Documents, 20MB, PDF-only), disk-based `uploadLmsFile` (LMS Materials/Submissions, 20MB, PDF/PPT/PPTX/DOC/DOCX), and two ad hoc memory-storage multer instances (Subjects import 10MB, Academic Import 15MB) parsed in-process and never persisted.
3. **Export/download endpoints**: `GET /subjects/export`, `GET /lms/materials/:id/download`, `GET /lms/submissions/:id/download`, `GET /reports/export/{pdf,excel,csv}`.
4. **Realtime**: `eventBus.service.ts` + Socket.IO is wired at the server level, but no route file shows explicit socket-handshake auth verification — flagged as a security review item in [07-authentication-and-security.md](07-authentication-and-security.md) §7.10.
5. **Soft deletes**: virtually every service filters `WHERE deleted_at IS NULL` — see [06-database.md](06-database.md) §6.5 for the exceptions.
