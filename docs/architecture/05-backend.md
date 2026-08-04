# 5. Backend Documentation

← [Back to Index](00-INDEX.md)

The backend is a monolithic Express 4 + TypeScript application (CommonJS, compiled via `tsc`), with **no ORM** — every query is hand-written SQL against the `pg` driver. It follows a strict **Route → Controller → Service → Database** layering, plus a **Registry** facade layer for cross-module reads (see [02-architecture-and-diagrams.md](02-architecture-and-diagrams.md)).

## 5.1 Application Entry & Global Middleware

**`server.ts`**: verifies PostgreSQL connectivity before listening (`pool.connect()`, exits(1) on failure); creates the HTTP server from `createApp()`; attaches a `socket.io` `Server` to the same HTTP server (CORS mirrors `env.CORS_ORIGIN`); calls `eventBus.init(io)`. Graceful shutdown on `SIGTERM`/`SIGINT` (closes server, drains pg pool, force-exits after 10s); `unhandledRejection`/`uncaughtException` handlers close the server and exit.

**`app.ts`** (`createApp()`) — global middleware stack, in order:
1. `app.set('trust proxy', 1)` — correct `req.ip` behind a proxy (used by rate limiter and audit logging).
2. `helmet()` — security headers.
3. `cors({ origin: env.CORS_ORIGIN.split(','), credentials: true, methods: GET/POST/PUT/PATCH/DELETE/OPTIONS, allowedHeaders: Content-Type/Authorization })`.
4. `express.json({ limit: '10mb' })` + `express.urlencoded({ extended: false })`.
5. `cookieParser()`.
6. `requestLogger` — logs `METHOD URL STATUS DURATIONms`.
7. `globalLimiter` — 1000 req/15min per IP.
8. `app.use('/api', apiRouter)` — mounts the entire route tree.
9. 404 handler.
10. `errorHandler` — last middleware (§5.5).

A stricter `authLimiter` (10 req/15min) applies only to `POST /api/auth/login`.

## 5.2 Routes (43 files, ~230 endpoints)

Every route file mounts under `/api` via `routes/index.ts`. Full endpoint-by-endpoint reference: **[09-api-documentation.md](09-api-documentation.md)**. Summary table:

| Base path | File | Domain |
|---|---|---|
| `/auth` | auth.routes.ts | Login/refresh/logout/me |
| `/search` | search.routes.ts | Global search |
| `/profile` | profile.routes.ts | Own-account profile/password |
| `/dashboard` | dashboard.routes.ts | Per-role dashboard aggregation |
| `/accountants` | accountant.routes.ts | Accountant account CRUD |
| `/departments` | departments.routes.ts | Departments & Programs |
| `/students` | students.routes.ts | Student CRUD & listing |
| `/faculty`, `/faculty-operations` | faculty.routes.ts, facultyOperations.routes.ts | Faculty CRUD; faculty operations center (dashboard/tasks/workload/workflow-logs/analytics) |
| `/subjects` | subjects.routes.ts | Subject catalog, curriculum mappings, Excel import/export |
| `/attendance` | attendance.routes.ts | Attendance assignments, roster, marking, history |
| `/internal-marks` | internal-marks.routes.ts | Internal assessment marks |
| `/examinations`, `/exam-sessions`, `/exam-rooms`, `/exam-seating`, `/exam-invigilation`, `/seating-patterns` | (6 files) | Examination scheduling/seating/invigilation family |
| `/results`, `/result-entry-tasks` | result.routes.ts, resultEntryTask.routes.ts | Results + task-based entry/verify/publish workflow |
| `/fees` | fee.routes.ts | Fee invoices & payments |
| `/announcements` | announcement.routes.ts | Institutional announcements |
| `/documents`, `/parsed-events`, `/calendar` | document.routes.ts, parsedEvent.routes.ts, academicCalendar.routes.ts | PDF upload → rule-based event extraction → published calendar |
| `/lms/materials`, `/lms/assignments`, `/lms/submissions` | material/lmsAssignment/lmsSubmission.routes.ts | LMS |
| `/opportunities` | opportunityHub.routes.ts | Placement/internship/event postings + bookmarks |
| `/notifications`, `/calendar-entries` | notification.routes.ts, calendarEntry.routes.ts | Notifications; personal calendar feed |
| `/mentorship`, `/mentor-groups`, `/mentorship-settings` | (3 files) | Mentorship (legacy 1:1 + group-based) |
| `/analytics`, `/reports`, `/experience` | (3 files) | Analytics, reports/exports, personalized timeline |
| `/feedback` | feedback.routes.ts | Feedback campaigns |
| `/workflow` | workflowRule.routes.ts | Configurable notification/automation rules (super-admin only) |
| `/subject-allocations` (deprecated), `/teaching-assignments`, `/teaching-plans`, `/teaching-load-settings` | (4 files) | Teaching workload assignment & lesson-progress tracking |
| `/academic-import` | academicImport.routes.ts | Generic bulk spreadsheet import engine |
| `/timetables` | timetable.routes.ts | Timetable generation/publishing |
| `/example` | protected.routes.ts | Reference implementation of the 6 auth patterns (not business logic) |
| `/health` | inline in `app.ts` | Liveness check, no auth |

**Route-ordering discipline**: nearly every route file explicitly declares static/literal segments (`/me`, `/export`, `/bookmarks`, `/count`, `/:id/status`) before the generic `/:id` route, to avoid Express param-shadowing — a consistent, deliberate convention across the codebase.

## 5.3 Controllers

42 controller files, one roughly per route file — thin HTTP adapters: parse/validate is already done by middleware, so a controller typically extracts `req.user`/`req.params`/`req.body`, calls exactly one service method, and returns via `sendSuccess`/`sendCreated` (or throws an `AppError`, caught by the global handler). No business logic lives here.

## 5.4 Services (60 files) — Ownership Model

**Architectural pattern: one owning service per table.** Each service exposes CRUD + domain operations for the table(s) it owns, and other modules read cross-entity data through either (a) the owning service's exported functions, or (b) the **Registry facade layer** rather than querying tables directly. See [08-modules.md](08-modules.md) for the full per-module service breakdown and [09-api-documentation.md](09-api-documentation.md) for which tables each service touches.

**Cross-cutting / infrastructure services (no direct routes):**

| Service | Purpose |
|---|---|
| `eventBus.service.ts` | Singleton wrapping the Socket.IO server; `publish(type, payload)`, transaction-aware via `AsyncLocalStorage` (deferred until commit) |
| `export.service.ts` | Shared Excel/PDF/CSV renderer (ExcelJS + PDFKit), 5000-row cap, used by Subjects export and Reports export |
| `actionEngine.service.ts` / `timelineEngine.service.ts` | Student/Faculty "Experience" aggregation-and-rules layer (composes ~10 other services, no own tables) |
| `workflowEngine.service.ts` | Generic rule execution + audit engine (`workflow_rules`, `workflow_logs`) driving Result Entry Task approvals and configurable notification triggers |
| `facultyDailyStatus.service.ts`, `facultyTasks.service.ts`, `facultyWorkload.service.ts` | Faculty Operations Center support aggregations |
| `dashboardAggregator.service.ts` | Shared aggregation helper underlying per-role dashboard endpoints |
| `resourceAvailability.service.ts` | Shared room/invigilator availability engine used by exam-room, exam-invigilation, exam-session modules |

## 5.5 Registries (`backend/src/registries/`, 6 files + barrel)

An internal, non-routed "master data" facade layer — no independent tables of their own. Purpose: prevent the ~20-45 ad hoc duplicate lookup queries that existed before consolidation.

| Registry | Wraps | Consolidates |
|---|---|---|
| `studentRegistry.service.ts` | `student.service.ts` | Core student-identity lookups (roll no, name, dept, program, semester, section, year) — replaced ~20 call sites |
| `facultyRegistry.service.ts` | `faculty.service.ts` | Core faculty-identity lookups — replaced ~25 call sites |
| `academicRegistry.service.ts` | `department.service.ts` | Departments/Programs/"Academic Session" (the latter is just `students.academic_year`, not a real table — by design), TTL-cached |
| `curriculumRegistry.service.ts` | `subject_curriculum_mappings` | Resolves "what should this student/section study" by (department, regulation, semester) |
| `teachingAssignmentRegistry.service.ts` | `teachingAssignment.service.ts` + `assignment.service.ts` | The shared "is this faculty assigned to this subject/section" check, used by Attendance/LMS/Internal Marks/Results |
| `resourceRegistry.service.ts` | `examRoom.service.ts` | "What rooms exist / are available" for Timetable, Events, Labs |

## 5.6 Middleware (`backend/src/middleware/`)

Full detail in [07-authentication-and-security.md](07-authentication-and-security.md). Summary:

| File | Purpose |
|---|---|
| `authenticate.ts` | Bearer/`?token=` JWT verification → populates `req.user` |
| `authorize.ts` | `authorize()` (permission matrix), `requireRole()` (coarse allowlist), `requireSuperAdmin()` |
| `mentorshipAuth.ts` | Record-level authorization for Mentorship (mentor/mentee/note-owner scoping) |
| `rateLimiter.ts` | `globalLimiter` (1000/15min), `authLimiter` (10/15min on login) |
| `errorHandler.ts` | Global error handler (§5.9) |
| `requestLogger.ts` | Console request/response logging |
| `upload.ts` | `uploadPdf` — disk storage, 20MB, PDF-only (Documents) |
| `uploadLms.ts` | `uploadLmsFile` — disk storage, 20MB, PDF/PPT/PPTX/DOC/DOCX (LMS) |
| `validate.ts` | Zod schema validation middleware factory for body/params/query |

Two additional ad hoc multer instances exist inline in route files (not shared middleware): memory-storage 10MB in `subjects.routes.ts` (Excel/CSV import preview) and memory-storage 15MB in `academicImport.routes.ts` (generic spreadsheet import) — both parsed in-process, never persisted to disk.

## 5.7 Authentication & Authorization

See [07-authentication-and-security.md](07-authentication-and-security.md) for the complete mechanics (JWT signing, refresh rotation with reuse detection, bcrypt cost factor, permission matrix, record-level checks).

## 5.8 Validation

`middleware/validate.ts` wraps per-domain Zod schemas defined in `backend/src/types/*.ts`; on failure it throws `AppError.badRequest` with a joined `field: message` string, code `VALIDATION_ERROR`. Every list endpoint has its own `list*QuerySchema` (page/limit pagination, default page=1/limit=20, max 100 observed in Opportunity Hub).

## 5.9 Error Handling

**`errors/AppError.ts`** — a single class (no subclass hierarchy) with static factories: `badRequest` (400), `unauthorized` (401), `forbidden` (403), `notFound` (404), `conflict` (409), `internal` (500, the only factory setting `isOperational=false`). Each throw site supplies its own machine-readable `code` string (decentralized code taxonomy, e.g. `NOT_ASSIGNED_MENTOR`, `MISSING_REQUIRED_HEADERS`).

**`middleware/errorHandler.ts`** — global handler (last in the middleware stack): maps Postgres error codes (`23505`→409 `DUPLICATE_RECORD`, `23503`→400 `FOREIGN_KEY_VIOLATION`, `23502`→400 `NOT_NULL_VIOLATION`); passes through operational `AppError`s with their own status/code/message; everything else is logged via `console.error` and returns 500 `INTERNAL_ERROR` (message hidden in production, shown in dev/test).

**Response envelope** (`utils/response.ts`): `{success:true, data, message?, metadata?}` on success (`sendSuccess`/`sendCreated`); `{success:false, code, message}` on error, optionally with a field-level `errors:[{field?,message}]` array (`sendError`).

## 5.10 Database Access

`config/database.ts` — `pg.Pool` (max 10, idle timeout 30s, connection timeout 30s to tolerate Neon cold starts); SSL auto-enabled when the connection string contains `sslmode=` or `neon.tech`; `pool.on('error')` logs but never crashes the process on a dropped idle client. `query<T>()` is a thin logging wrapper (SQL + duration + row count, dev-only). `withTransaction<T>(fn)` runs `BEGIN`/`fn(client)`/`COMMIT` inside an `AsyncLocalStorage`-backed context so deeply-nested code can queue domain events without threading context through every function signature; on commit, queued events are emitted via `eventBus`; on any throw, `ROLLBACK`; `finally` always releases the client. See [06-database.md](06-database.md) for the schema itself.

## 5.11 Utilities (`backend/src/utils/`)

| File | Purpose |
|---|---|
| `asyncHandler.ts` | Wraps async handlers → forwards rejected promises to `next(err)` |
| `audit.ts` | `auditLog()` → `audit_logs` table (captures actor, action, resource, changes, IP, user-agent) |
| `calendarExtractor.ts` | Rule-based PDF-text → academic-calendar-event extractor (regex date parsing, event-type/audience classification, dedup) |
| `jwt.ts` | Access/refresh token sign/verify |
| `password.ts` | bcryptjs hash/verify (cost from `env.BCRYPT_ROUNDS`) |
| `response.ts` | Success/error response envelope helpers |
| `ttlCache.ts` | In-process `Map`-based TTL memoizer — a deliberate no-Redis, single-instance solution for un-memoized dashboard/analytics reads |
| `validation.ts` | Password-strength regex + Zod schema (used at set-time, not login-time) |

## 5.12 Configuration

`config/env.ts` (Zod-validated, fail-fast on `process.exit(1)` if invalid): `NODE_ENV`, `PORT` (3001), `DATABASE_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (min 32 chars), `JWT_ACCESS_EXPIRES_IN` (15m)/`JWT_REFRESH_EXPIRES_IN` (7d), `BCRYPT_ROUNDS` (10–14, default 12), `CORS_ORIGIN`, `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX` (⚠ defined but **not actually read** by `rateLimiter.ts`, which hardcodes its own values — vestigial env vars), `UPLOAD_DIR`, `LMS_UPLOAD_DIR`. `config/grading.ts` holds the grade-boundary table (§5.13). Full config file inventory: [13-deployment-config-dependencies.md](13-deployment-config-dependencies.md).

## 5.13 Business-Rule Config (not env-driven)

`config/grading.ts`: `GRADES = ['O','A+','A','B+','B','C','F']`, `DEFAULT_GRADE_RULES` (percentage-band → grade → pass/fail, JNTUH-aligned), `computeGrade()`/`computeResultStatus()` as pure functions. A code comment documents a planned future move to a DB-driven `grading_configs` table keyed by (program, regulation) if multiple simultaneous grading schemes are ever needed.

## 5.14 Logging

Console-only (`console.log`/`console.error`/`console.warn`/`console.debug`) — **no structured logging library** (no winston/pino). `requestLogger.ts` logs every request/response; `config/database.ts` logs SQL in development only; `errorHandler.ts` logs unhandled errors. There is no log aggregation/shipping configured (expected, given no deployment infra exists — see [13](13-deployment-config-dependencies.md)).

## 5.15 Importers / Exporters

**Importers** — a generic, entity-agnostic pipeline (`backend/src/import/`): `ExcelParser.ts` (header-auto-detecting `.xlsx/.xls/.csv` parser via `exceljs`), `ImportStrategy.ts` (interface every entity importer implements), `ImportTransactionManager.ts` (chunked commit, default 500 rows/chunk, wrapped in one `withTransaction` so a mid-import failure rolls back the entire job), `ValidationPipeline.ts` (parse → header-check → strategy validation → summary), `strategyRegistry.ts` (entity-type → strategy map). **Only the Student importer is implemented** (`strategies/studentImport.strategy.ts`, 796 lines — supports Merge/create-or-update-by-roll-number and Replace/wipe-and-reimport modes); Faculty/Subjects/Curriculum/Teaching-Assignment/Department/Classroom/Timetable/Exam-Schedule strategies are documented as planned but not built (`getImportStrategy()` throws `IMPORT_STRATEGY_NOT_IMPLEMENTED` for them). The Subjects module has its own separate, simpler Excel importer (`subjectImport.service.ts`) predating the generic framework.

**Exporters** — `export.service.ts`: CSV (manual escaping + UTF-8 BOM), Excel (ExcelJS, optional Summary sheet + data sheet), PDF (PDFKit, auto-landscape >6 columns, pagination, truncation notice) — all capped at 5000 rows ("a rendering convenience, not a bulk data dump"). Used by Subjects export and the Reports module's `/export/{pdf,excel,csv}` endpoints.

## 5.16 Schedulers / Background Jobs

⚠ **None exist.** No cron/node-schedule/agenda/bull/bullmq anywhere in the codebase or dependencies. Consequences: expired/revoked `refresh_tokens` rows are never purged; all work is request-driven or event-driven (via `eventBus`+Socket.IO), never time-driven. See [15-future-and-appendix.md](15-future-and-appendix.md) for this as a flagged improvement area.
