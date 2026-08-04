# 1. Project Overview, Technology Stack & User Roles

← [Back to Index](00-INDEX.md)

## 1.1 Purpose

The College ERP is a centralized web platform that digitizes the academic and administrative operations of a single college: student/faculty records, attendance, examinations & results, fees, timetabling, learning-management (LMS), mentorship, feedback campaigns, placement/opportunity postings, academic-calendar management, and cross-cutting reporting/analytics. It replaces spreadsheet- and paper-based processes with one relational source of truth, scoped by role-based access control.

## 1.2 Target Users

Five distinct user populations interact with the system, mapped to 4 database roles plus 2 designation/capability flags layered on top of `faculty`:

| Population | DB Role | How they're distinguished |
|---|---|---|
| System/College Administrator | `admin` | Role value; an `is_super_admin` boolean additionally unlocks Workflow Rule configuration |
| Head of Department (HOD) | `faculty` | `faculty.designation = 'hod'` (one HOD per department, DB-enforced via partial unique index) |
| Mentoring Head | `faculty` | `faculty.is_mentoring_head = true` capability flag (department-wide mentorship oversight) |
| Regular Faculty | `faculty` | Default designation values (professor/associate_professor/assistant_professor/lecturer) |
| Student | `student` | Role value; scoped to own records only |
| Accounts Office Staff | `accountant` | Role value; scoped to Fees module |

⚠ **Note**: the planning documents (`project_vision_and_requirements.md`) additionally describe Librarian, Parent/Guardian, and Placement Officer as *future* roles, and a `SYSTEM_MODEL.md`/`ARCHITECT_REVIEW.md` "Super Admin" as a role distinct from Admin. In the actual implementation, none of these exist as separate `user_role` enum values — Super Admin is a boolean flag on an `admin` user, and Librarian/Parent/Placement Officer are not implemented at all (see [15-future-and-appendix.md](15-future-and-appendix.md) for the gap list). The frontend's `PermissionContext`/`lib/permissions.ts` layer additionally recognizes a richer set of *RBAC labels* (`Super Admin`, `College Admin`, `HOD`, `Academic Coordinator`, `Placement Officer`, `Mentoring Head`, `Faculty`, `Student`) purely for UI nav-filtering purposes — these are **not** backed by distinct database roles; they are derived client-side from the 4 real roles plus designation/flags.

## 1.3 Problem Statement

Colleges running manual/spreadsheet-based operations suffer from: duplicated data entry across departments, delayed attendance/grade visibility, no single audit trail for financial or academic record changes, ad hoc scheduling with undetected conflicts, and no unified channel for announcements, assignments, or placement opportunities. The ERP addresses this by making every academic transaction (attendance mark, grade entry, fee payment, teaching assignment) a row in one relational database, visible in real time (via Socket.IO) to every authorized party.

## 1.4 Objectives

- Provide one authenticated portal per role with data strictly scoped to what that role owns or is entitled to see (see [07-authentication-and-security.md](07-authentication-and-security.md)).
- Make attendance, results, and fee status available to students in real time.
- Give faculty a single "Operations Center" (dashboard, tasks, workload) instead of scattered spreadsheets.
- Give admins configurable, auditable workflows (Workflow Rule engine) instead of hard-coded notification logic.
- Support bulk onboarding via spreadsheet import (students, subjects/curriculum) rather than manual entry.
- Maintain an append-only audit trail (`audit_logs`, `workflow_logs`) for security-sensitive actions.

## 1.5 Scope

**In scope (implemented):** Authentication & RBAC; Student/Faculty/Accountant provisioning; Departments & Programs; Subjects & Curriculum Mapping; Teaching Assignments; Attendance; Internal Marks; Examinations (scheduling, sessions, seating, invigilation); Results (with a task-based entry/verify/publish workflow); Fees & Payments; Timetabling; LMS (materials, assignments, submissions/grading); Teaching Plans ("Lesson Progress Engine"); Mentorship (1:1 legacy + group-based); Feedback Campaigns; Opportunity Hub (placements/internships/events) with bookmarking; Notifications & Announcements; Academic Calendar (including PDF-based auto-extraction of calendar events); Bulk Academic Data Import; Workflow Rule engine; Analytics/Reports/Exports (PDF/Excel/CSV); Global Search.

**Out of scope (not implemented, see planning docs' aspirations):** Library management, Hostel/Transport modules, Parent portal, Placement-drive-specific workflow (only a generic Opportunity posting exists), payment gateway integration (fees are recorded manually, not processed online), biometric attendance, AI/predictive analytics, multi-language support, background job scheduler (no cron/queue — see [12](12-performance-error-handling-workflow.md)).

## 1.6 Major Features

See [08-modules.md](08-modules.md) for the full per-module breakdown. At a glance: 4-role JWT auth with refresh-token rotation and reuse detection · fine-grained + record-level authorization · 43 route files / ~230 REST endpoints · 60 backend tables across 12 functional domains · a task-based Result entry→verify→publish approval chain · an auto-balancing mentor-group allocator · a rule-based PDF calendar-event extractor · a generic multi-format (CSV/Excel/PDF) export engine · a configurable Workflow Rule engine driving in-app notifications from domain events · realtime push via Socket.IO for attendance/teaching-plan/exam-seating/notification updates.

## 1.7 Future Scope

See [15-future-and-appendix.md](15-future-and-appendix.md) §Future Improvements for the full list (containerization/CI, background job queue, Redis caching, payment gateway, AI-driven analytics, Library/Hostel/Transport/Parent-portal modules, automated testing on the frontend, WebSocket auth hardening).

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend framework | **Next.js 16** (App Router), **React 19**, TypeScript | `next.config.ts` is essentially default — no custom rewrites/SSR data-fetching strategy; effectively a client-rendered SPA calling an external API |
| Frontend styling | **TailwindCSS 4** (+ `@tailwindcss/postcss`) | Utility-first; dark/light theme via CSS variables + `SimulationContext` |
| Frontend data/state | **@tanstack/react-query 5** (partial use), React Context (Auth/Simulation/Permission/Socket), plain `useState` (majority of pages) | No Redux/Zustand; see [04-frontend.md](04-frontend.md) §State Management |
| Frontend charts | **Recharts 3** | Dashboard/analytics visualizations |
| Frontend realtime | **socket.io-client 4.8** | Auth via `{token: accessToken}` handshake payload |
| Icons | **lucide-react** | |
| Backend runtime | **Node.js**, **Express.js 4**, TypeScript (CommonJS output) | No web framework beyond Express; no ORM |
| Backend DB access | **pg 8** (raw SQL, hand-written queries), `AsyncLocalStorage`-based transaction context | See [05-backend.md](05-backend.md) |
| Database | **PostgreSQL** (Neon serverless Postgres in practice — connection string SSL logic special-cases `neon.tech`) | 50 versioned SQL migrations, `schema_migrations` tracking table |
| Auth | **jsonwebtoken 9** (HS256, separate access/refresh secrets), **bcryptjs 2** (cost 12), **cookie-parser** (httpOnly refresh cookie) | See [07-authentication-and-security.md](07-authentication-and-security.md) |
| Validation | **Zod 3** (both a request-validation middleware factory on the backend, and ad hoc on the frontend not at all — frontend has no schema validation library) | |
| Realtime (server) | **socket.io 4.8** | In-process `eventBus.service.ts` pub/sub wrapper, transaction-aware |
| File processing | **multer 2** (uploads), **exceljs 4** (Excel/CSV read+write), **pdfkit 0.19** (PDF generation), **pdf-parse 2.4** (PDF text extraction for calendar auto-import) | |
| Security middleware | **helmet 8**, **cors 2.8**, **express-rate-limit 7** | |
| Testing | **Jest 29** + **ts-jest** (backend only — 20 service-level test files); **no frontend test runner configured** | |
| Build tools | `tsc` (backend compile to `dist/`), Next.js's own bundler (frontend) | |
| Package manager | npm (both `frontend/` and `backend/` have their own `package.json` and `node_modules`) | |
| Dev tools | `tsx` (backend dev/hot-reload runner), ESLint 9 flat-config (frontend only — **backend has no ESLint config**) | |
| Version control | Git (this repository) | No CI/CD pipeline configured (no `.github/workflows`) — see [13-deployment-config-dependencies.md](13-deployment-config-dependencies.md) |

Full dependency-by-dependency breakdown with rationale: [13-deployment-config-dependencies.md](13-deployment-config-dependencies.md) §Dependencies.

---

## 3. User Roles — Detailed Permission Matrix

The backend defines exactly 4 roles (`backend/src/types/roles.ts`, `ROLES = ['admin','faculty','student','accountant']`) and a static `PERMISSIONS` map of `resource:action → allowed roles`, enforced by the `authorize()` middleware (coarse role checks use `requireRole()` instead — both idioms coexist). Record-level (not just role-level) checks exist only for the Mentorship module (`middleware/mentorshipAuth.ts`).

| Resource : Action | admin | faculty | student | accountant |
|---|:---:|:---:|:---:|:---:|
| users: create/update/delete | ✅ | | | |
| users: read | ✅ | ✅ | ✅ | ✅ |
| accountants: * | ✅ | | | |
| departments/courses/subjects: create/update/delete | ✅ | | | |
| departments/courses/subjects: read | ✅ | ✅ | ✅ | |
| attendance: create/update | | ✅ | | |
| attendance: read | ✅ | ✅ | ✅ | |
| grades (internal marks/results): create/update | | ✅ | | |
| grades: read | ✅ | ✅ | ✅ | |
| fees: create/update | ✅ | | | ✅ |
| fees: read | ✅ | | ✅ | ✅ |
| reports: read | ✅ | ✅ | | ✅ |
| mentorship: manage (assign/reassign/groups) | ✅ | | | |
| mentorship: read | ✅ | ✅ | ✅ | |
| mentorship: write (notes) | | ✅ | | |
| workflow rule configuration | ✅ (super-admin only) | | | |

Capability flags layered on top of role, used for scoping rather than access grant/deny:
- `users.is_super_admin` — only gate for `/api/workflow/rules*` endpoints.
- `faculty.designation = 'hod'` — one per department (DB-enforced); used to scope Faculty Operations/Analytics/Dashboard `hod` variants (`requireRole('faculty')` at the route, then the service checks `designation`).
- `faculty.is_mentoring_head` — grants department-wide mentorship management (assign/reassign/groups/reports) instead of just self-scoped mentee access.

### Ownership model (who owns what data)
- **Students** own: their assignment submissions, feedback answers, bookmarks, profile contact fields. They have read-only access to attendance, internal marks, results, fees, seating, timetable — all scoped to their own `student_id`.
- **Faculty** own: attendance/marks/results/teaching-plans/materials/assignments for subjects they hold an active `teaching_assignments` row for (enforced by the `teachingAssignmentRegistry` resolution helpers, not just role checks).
- **Admin** owns: master data (departments, programs, subjects, curriculum mappings, teaching assignments, fee records, announcements, workflow rules) and provisions all user accounts.
- **Accountant** owns: fee/payment records (shared write access with Admin).

See [07-authentication-and-security.md](07-authentication-and-security.md) for the full authentication/authorization mechanics and [11-business-logic-and-sync-matrix.md](11-business-logic-and-sync-matrix.md) for lifecycle/state-machine detail per entity.
