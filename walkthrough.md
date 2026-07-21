# Walkthrough: Subjects Master Module with Excel Import & CRUD

We have successfully implemented the enterprise-grade **Subjects Master** module. It serves as the single source of truth for all course metrics, credits, syllabus configurations, and regulations in the ERP. All subsequent modules (Subject Allocation, LMS, Attendance, Marks, Results) now interface directly with this catalog.

---

## 1. Database & Migrations

- **[NEW] [035_subjects_master_updates.sql](file:///c:/Users/spybh/Downloads/ERP/backend/src/db/migrations/035_subjects_master_updates.sql)**:
  - Extended the `subjects` table with columns: `regulation`, `year`, `semester_raw`, `lecture_hours` (L), `tutorial_hours` (T), `practical_hours` (P), `description`, and `program`.
  - Converted the `type` column to a standard `VARCHAR(50)` to allow flexible, future-proof subject types.
  - Made the `program_id` reference nullable to allow raw text schemes from Excel imports.
- **[MODIFY] [migrate.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/db/migrate.ts)**: Registered migration 035. Applied successfully.
- **[NEW] [036_subject_credits_decimal.sql](file:///c:/Users/spybh/Downloads/ERP/backend/src/db/migrations/036_subject_credits_decimal.sql)**:
  - Altered the `credits` column in the `subjects` table from `SMALLINT` to `NUMERIC(3,1)` to support fractional credits (such as `2.5` or `1.5`) matching academic standards. Applied successfully.
- **[NEW] [037_subject_credits_check_constraint.sql](file:///c:/Users/spybh/Downloads/ERP/backend/src/db/migrations/037_subject_credits_check_constraint.sql)**:
  - Dropped the legacy `subjects_credits_check` database constraint and redefined it as `CHECK (credits >= 0 AND credits <= 10)` to support non-credit courses. Applied successfully.

---

## 2. Backend Architecture

### Services
- **[NEW] [subjectImport.service.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/services/subjectImport.service.ts)**:
  - Parses spreadsheet buffers (`.xlsx`, `.xls`, `.csv`) case-insensitively.
  - Implements **fuzzy department matching** mapping string variations (like `AI & ML`, `AI/ML`, `CSE`, `Computer Science`, `ECE`) to DB codes.
  - Validates cells against constraint requirements (numeric formats for credits between 0 and 10, non-negative L-T-P, years I-IV, semesters I-II, and normalized type groupings).
  - Matches department strings to database IDs.
  - Skips duplicate codes silently inside the import list and DB.
  - Returns structured preview results and syntax-failure reports.
- **[MODIFY] [subject.service.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/services/subject.service.ts)**:
  - Added new filter operators (regulation, year, free-text programs).
  - Handles Year/Semester string conversion to database semester IDs (1-8) for backward compatibility.
  - Implements **soft delete usage guards** checking allocations, attendance records, test marks, exam results, teaching plans, and LMS materials, throwing a warning block if the subject is actively referenced.
- **[MODIFY] [subjectAllocation.service.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/services/subjectAllocation.service.ts)**: Updated `getSubjectProfile` to use `LEFT JOIN` on programs and retrieve regulation, hours, and description data.

### Controllers & Routes
- **[MODIFY] [subject.controller.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/controllers/subject.controller.ts)**:
  - Created endpoints for bulk spreadsheet previews, final commits, status toggling, and exports.
  - Integrated list retrieval with the pagination engine.
- **[MODIFY] [subjects.routes.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/routes/subjects.routes.ts)**:
  - Configured memory storage Multer uploader.
  - Secured endpoints: Admin has full write/import permissions, HODs have department-locked read-only views, Faculty have allocation-based read-only views, and Students/Accountants/Mentors are blocked.
- **[MODIFY] [authenticate.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/middleware/authenticate.ts)**: Extended authorization to look up token query parameters, facilitating secure window-redirect downloads.

---

## 3. Frontend Architecture

### Core Components
- **[NEW] [SubjectCatalogManager.tsx](file:///c:/Users/spybh/Downloads/ERP/frontend/src/components/Subjects/SubjectCatalogManager.tsx)**:
  - **Summary Metrics Grid**: Displays cards showing totals, active/inactive counts, core/lab/elective/mandatory divisions, and department totals.
  - **Toolbar Controls**: Search bar, filter inputs (Department, Program, Regulation, Year, Sem, Type, Status), manual record addition form, spreadsheet imports uploader, red **Delete All** wipe operator, and multi-format exports triggers.
  - **Uploader Preview**: Drag-and-drop spreadsheet uploader rendering verified rows in a preview table, listing failure lines, showing progress logs, and offering direct CSV error report downloads.
  - **Bulk Wipe Modal**: Confirms bulk deletion. Soft-deletes ALL subjects currently registered in the database catalog, irrespective of status or active use.
  - **Soft Delete Modal**: Confirms soft-deletion, displaying warning flags when blocked by database usage constraints.
- **[MODIFY] [Sidebar.tsx](file:///c:/Users/spybh/Downloads/ERP/frontend/src/components/Sidebar.tsx)**:
  - Mounted "Subjects" catalog navigation menu under the Academics group for Admins and HODs.

### Pages & Routes
- **[NEW] [page.tsx (Admin Subjects)](file:///c:/Users/spybh/Downloads/ERP/frontend/src/app/admin/subjects/page.tsx)**: Admin-mode mounting.
- **[NEW] [page.tsx (HOD Subjects)](file:///c:/Users/spybh/Downloads/ERP/frontend/src/app/hod/subjects/page.tsx)**: HOD-mode mounting.
- **[MODIFY] [[id]/page.tsx (Subject Profile)](file:///c:/Users/spybh/Downloads/ERP/frontend/src/app/admin/subjects/%5Bid%5D/page.tsx)**: Displays the expanded parameters grid (regulation, credits, L-T-P hours structure, enrollment rates, and status logs).
- **[MODIFY] [page.tsx (Admin Courses / Curriculum Scheme)](file:///c:/Users/spybh/Downloads/ERP/frontend/src/app/admin/courses/page.tsx)**:
  - Replaced the static courses tree listing with a fully dynamic **Curriculum Scheme Configurator**.
  - Adds program selection tabs and regulation selectors dynamically populated from database endpoints.
  - Groups curriculum subjects year-wise (**Year I** to **Year IV**), split into absolute semesters.
  - Dynamically queries and displays **active faculty teaching allocations** side-by-side with course cards, alerting when allocations are pending.

---

## 4. Verification & Performance Optimization

We validated both apps for complete compilation safety:
- **Backend Compiler Output**: `npx tsc --noEmit` in `backend/` -> **Passed successfully with 0 errors.**
- **Frontend Compiler Output**: `npx tsc --noEmit` in `frontend/` -> **Passed successfully with 0 errors.**

### Optimization Enhancements:
- **Payload Capacity**: Increased the Express JSON body parser size limit in [app.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/app.ts) from `10kb` to `10mb`. This resolves the `413 Payload Too Large` error when transferring parsed arrays containing dozens of subject records during spreadsheet import commits.
- **Query Validation Cap**: Raised the maximum paginated query listing constraint inside [types/subject.ts](file:///c:/Users/spybh/Downloads/ERP/backend/src/types/subject.ts) from `1000` to `10000`, and adjusted stats request limits on the frontend to `1000` for balanced performance.
- **Subject Allocation Dropdowns Synchronization**:
  - Sourced `departmentId` in the `FacultySummary` list endpoint (`faculty.service.ts` to `toSummary`), allowing correct mapping filters by department in the creation modal.
  - Sourced `programId` in the `SubjectSummary` list endpoint (`subject.service.ts` to `toSummary`).
  - Updated the frontend matching logic inside `AllocationManager.tsx` to resolve subjects imported via Excel that map program constraints via text string names (`programName`) rather than database primary relation indices (`programId`).


