# 3. Complete Folder Structure

← [Back to Index](00-INDEX.md)

## 3.1 Repository Root

```
ERP/
├── frontend/                    # Next.js 16 client application
├── backend/                     # Express/TypeScript API server
├── docs/                        # Miscellaneous engineering docs + this architecture document
│   └── architecture/            # ← this Software Architecture Document
├── AGENTS.md                    # AI-agent operating instructions for this repo
├── CLAUDE.md                    # Points to AGENTS.md
├── README.md                    # Project intro, setup instructions
├── project_vision_and_requirements.md   # Original planning doc (aspirational, MVP-oriented)
├── ARCHITECT_REVIEW.md          # Early architecture review notes
├── SYSTEM_MODEL.md              # Conceptual entity/actor model (planning-stage)
├── BUSINESS_RULES_AND_WORKFLOWS.md      # Planning-stage business rules
├── MVP_DEFINITION_AND_DEVELOPMENT_ROADMAP.md   # Original 3-week MVP roadmap
├── UI_UX_BLUEPRINT.md           # UI/UX design system spec (mostly matches implementation)
├── walkthrough.md               # Dev log for the Subjects Master module
├── sample_student_import.csv    # Sample file for the student bulk-import feature
└── I SEMESTER ROLL LIST WITH FULL DATA.xlsx   # Real sample data used with the import pipeline
```

⚠ **Note**: the planning `.md` files at the root describe an earlier, smaller-scope MVP (3 roles, no approval workflows). They are retained for historical context but should not be treated as current-state documentation — this architecture document (`docs/architecture/`) supersedes them for "what the system actually does."

---

## 3.2 Backend — `backend/src/`

```
backend/src/
├── server.ts              # Process entrypoint: pg connectivity check, HTTP+Socket.IO server, graceful shutdown
├── app.ts                 # createApp(): global Express middleware stack + route mounting (see 02-architecture)
├── config/
│   ├── env.ts              # Zod-validated environment schema; fail-fast on invalid config
│   ├── database.ts         # pg Pool, query() helper, withTransaction() + AsyncLocalStorage event context
│   └── grading.ts          # Grade-boundary constants (O/A+/A/B+/B/C/F) + computeGrade/computeResultStatus
├── routes/                 # 43 files — one per resource, thin: middleware chain + controller wiring only
├── controllers/            # 42 files — HTTP adapters: parse req, call service, sendSuccess/sendError
├── services/                # 60 files — business logic; one "owning" service per table (see 05-backend.md)
├── registries/              # 6 facade services — cross-module lookups (Student/Faculty/Academic/Curriculum/TeachingAssignment/Resource) + index.ts barrel
├── middleware/
│   ├── authenticate.ts       # JWT verification → req.user
│   ├── authorize.ts          # authorize()/requireRole()/requireSuperAdmin() — static RBAC
│   ├── mentorshipAuth.ts     # Record-level (mentor/mentee/note-owner) authorization
│   ├── validate.ts           # Zod schema validation middleware factory
│   ├── rateLimiter.ts        # globalLimiter + authLimiter (express-rate-limit)
│   ├── errorHandler.ts       # Global error handler (Postgres error code mapping + AppError formatting)
│   ├── requestLogger.ts      # Console-based request/response logging
│   ├── upload.ts             # Multer config — generic PDF documents (disk storage)
│   └── uploadLms.ts          # Multer config — LMS materials (PDF/PPT/DOC, disk storage)
├── errors/
│   └── AppError.ts           # Single error class + static factories (badRequest/unauthorized/forbidden/notFound/conflict/internal)
├── import/                  # Generic entity-agnostic bulk-import pipeline framework
│   ├── ExcelParser.ts         # .xlsx/.xls/.csv → row-object parser (header auto-detection)
│   ├── ImportStrategy.ts      # Interface every entity importer must implement
│   ├── ImportTransactionManager.ts   # Chunked, single-transaction commit orchestration
│   ├── ValidationPipeline.ts  # parse → validate → summarize glue
│   ├── strategyRegistry.ts    # ImportEntityType → strategy implementation map
│   └── strategies/
│       └── studentImport.strategy.ts   # The only implemented strategy (Merge/Replace modes)
├── db/
│   ├── migrate.ts             # Migration runner (handles enum ALTER TYPE special-casing)
│   ├── seed.ts, seed_exam_seating.ts, seed_feedback.ts   # Seed data scripts
│   ├── check.ts               # DB connectivity/sanity check script
│   ├── sync_roll_list.ts      # One-off script for syncing the Excel roll-list sample data
│   ├── query_student.ts, query_opportunities.ts, list_users_test.ts   # Ad hoc query/debug scripts
│   └── migrations/            # 50 numbered .sql files (001_... through 050_timetable_management.sql)
├── types/                   # Shared TypeScript types + Zod schemas per domain (roles.ts, auth.ts, subject.ts, etc.)
├── utils/
│   ├── asyncHandler.ts        # Wraps async route handlers → forwards rejections to next()
│   ├── audit.ts                # auditLog() → audit_logs table
│   ├── calendarExtractor.ts    # Rule-based PDF-text → academic calendar event extractor
│   ├── jwt.ts                  # Access/refresh token sign/verify
│   ├── password.ts             # bcryptjs hash/verify
│   ├── response.ts             # sendSuccess/sendCreated/sendError envelope helpers
│   ├── ttlCache.ts             # In-process Map-based TTL memoizer (no Redis)
│   └── validation.ts           # Password strength regex + Zod schema
└── __tests__/                # 20 Jest test files (service-level, ts-jest)

backend/uploads/
├── documents/                # uploadPdf target (Document Management)
└── lms/                      # uploadLmsFile target (Course Materials, Submissions)
```

---

## 3.3 Frontend — `frontend/src/`

```
frontend/src/
├── app/                      # Next.js App Router — file-based routing
│   ├── layout.tsx             # Root layout: fonts, metadata, <AppProviders>
│   ├── page.tsx               # Login page (root "/")
│   ├── admin/                 # 27 routes — layout.tsx gates role="admin"
│   │   ├── layout.tsx
│   │   ├── accountants/ analytics/ announcements/ attendance/ calendar/ courses/
│   │   ├── dashboard/ examinations/ faculty/ feedback/ fees/ import/ lms/[subjectId]/
│   │   ├── mentorship/ notifications/ opportunities/ profile/ reports/ results/
│   │   ├── seating/ settings/ students/ subject-allocations/ subjects/[id]/
│   │   └── teaching-planner/ timetables/ workflows/
│   ├── faculty/                # 18 routes — layout.tsx gates role="faculty"
│   │   ├── layout.tsx
│   │   ├── analytics/ announcements/ attendance/ calendar/ dashboard/ examinations/
│   │   ├── feedback/ grades/ invigilation/ lms/[subjectId]/
│   │   ├── mentorship/[groupId]/[studentId]/ notifications/ opportunities/ profile/
│   │   └── reports/ results/ subjects/ teaching-planner/ timetable/ workflows/
│   ├── hod/                    # 12 routes — layout.tsx gates role="faculty" + designation==="hod" check
│   │   ├── layout.tsx
│   │   └── analytics/ attendance/ classes/ dashboard/ faculty/ feedback/
│   │       mentorship/ reports/ seating/ students/ subject-allocations/ subjects/
│   │       (HOD reuses several /faculty/* routes directly for teaching-workload duties)
│   ├── student/                 # 17 routes — layout.tsx gates role="student"
│   │   ├── layout.tsx
│   │   └── analytics/ announcements/ attendance/ calendar/ dashboard/ examinations/
│   │       feedback/submit/ fees/ lms/[subjectId]/ mentorship/ notifications/
│   │       opportunities/[id]/bookmarks/ profile/ reports/ results/ seating/ timetable/
│   ├── accountant/              # 2 routes — layout.tsx gates role="accountant" (no AccessGuard layer)
│   │   ├── layout.tsx
│   │   └── dashboard/ fees/
│   └── unauthorized/            # Fallback page for AccessGuard/PermissionContext denial
├── components/                # Shared UI (see 04-frontend.md §Component Architecture for full file list)
│   ├── DashboardLayout.tsx, Sidebar.tsx, TopHeader.tsx, BottomNav.tsx, ProtectedRoute.tsx
│   ├── CalendarView.tsx, EventFormModal.tsx, PersonalEventModal.tsx, NotificationCenter.tsx
│   ├── FacultyFormDrawer.tsx, StudentFormDrawer.tsx, DeleteConfirmationModal.tsx, FacultyDeleteModal.tsx
│   ├── OpportunityCard.tsx, OpportunityFilterBar.tsx, OpportunityFormModal.tsx, PDFUploadModal.tsx
│   ├── Analytics/    # AccessGuard, AcademicSubNav, AnalyticsCharts, InsightCards, FilterPanel, ExportDialog, ProtectedComponentWrapper
│   ├── Dashboard/    # StatsCard, ActivityFeed, AssignmentWidget, CalendarWidget, DashboardCharts, OpportunityWidget, UpcomingEventsWidget, NotificationWidget, TeachingProgressCard, TodayTaskCenter, WorkloadCharts, MyTeachingAssignmentsCard
│   ├── Feedback/     # AnonymousCommentList, FeedbackCharts, CampaignForm, CampaignManager, FeedbackTemplatesManager, FeedbackWizard, SubjectFeedbackCard
│   ├── LMS/          # LMSDashboard, SubjectLMS, Modals/{AssignmentModal,GradingModal,MaterialModal,SubmissionModal}
│   ├── Profile/      # ProfileOverview, EditProfileForm, ChangePasswordForm
│   ├── Search/       # GlobalSearch
│   ├── Seating/      # SeatingChartGrid, PatternFormModal, RoomFormModal, SessionFormModal
│   ├── SubjectAllocation/   # AllocationManager
│   ├── Subjects/     # SubjectCatalogManager
│   ├── TeachingAssignment/  # TeachingAssignmentManager
│   ├── UX/           # ConfirmationDialog, EmptyState, SkeletonLoaders, UnifiedPagination, UnifiedSearchBar
│   └── UXL/          # ActionCenter, QuickActions, SmartProgressCard, TodayFocus, UnifiedTimeline
├── context/
│   ├── AuthContext.tsx         # Real backend session (user/token/login/logout/refresh)
│   ├── SimulationContext.tsx   # Legacy/demo local-state store + global theme + role-switch simulator (localStorage-persisted)
│   ├── SocketContext.tsx       # Socket.IO client connection
│   └── PermissionContext.tsx   # Derived RBAC role + path/widget access rules
├── providers/
│   └── AppProviders.tsx        # Composition root (QueryClient → Simulation → Auth → Socket → Permission → RealtimeSyncListener)
├── hooks/
│   ├── useRealtimeSync.ts      # Socket event → React Query cache invalidation + custom DOM events
│   └── useRegistry.ts          # React Query hooks wrapping apiFetch for shared "registry" lookups
├── lib/
│   ├── api.ts                  # apiFetch() — auth header injection, silent 401 refresh+retry
│   ├── permissions.ts          # RBAC role resolution + path/widget access rule tables
│   ├── lms.ts, opportunities.ts, search.ts, profile.ts, seating.ts, teachingPlan.ts, feedback.ts, mentorship.ts   # Domain type definitions
├── types/
│   └── opportunity.ts, subject.ts, academicImport.ts, realtime.ts, subjectAllocation.ts
└── globals.css                # Tailwind base + design tokens
```

### Folder-purpose summary table

| Folder | Purpose |
|---|---|
| `frontend/src/app` | Next.js App Router pages — one subtree per role, file path = URL path |
| `frontend/src/components` | Reusable React components, organized by domain subfolder; top-level = truly cross-role shared chrome |
| `frontend/src/context` | React Context providers for cross-cutting client state (auth, theme/simulation, sockets, permissions) |
| `frontend/src/providers` | Single composition root wiring all context providers + React Query in the correct nesting order |
| `frontend/src/hooks` | Reusable React hooks (realtime sync, shared data-fetching registries) |
| `frontend/src/lib` | Non-React utility/domain-type modules — the API client, RBAC engine, and per-domain TypeScript types |
| `frontend/src/types` | Additional shared TypeScript types not tied to a specific `lib/*` domain module |
| `backend/src/routes` | URL surface declarations — no business logic, only middleware wiring |
| `backend/src/controllers` | Thin request/response adapters between Express and services |
| `backend/src/services` | All business logic; each table has one "owning" service |
| `backend/src/registries` | Read-only facades so unrelated modules resolve shared master data through one path instead of ad hoc joins |
| `backend/src/middleware` | Cross-cutting request-pipeline concerns (auth, validation, rate limiting, uploads, errors) |
| `backend/src/import` | Generic bulk-import framework (parse → validate → chunked-transactional-commit) |
| `backend/src/db/migrations` | The authoritative schema history — 50 sequential, numbered SQL files |
| `backend/src/utils` | Small stateless helper modules (JWT, password hashing, audit logging, TTL cache, PDF-text extraction) |
| `backend/src/errors` | The single `AppError` class hierarchy used throughout the API |
| `backend/uploads` | Local-disk file storage target for both upload middlewares (no object storage/CDN) |
