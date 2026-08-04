# 15. Future Improvements, Appendix & Undocumented/Missing Components

← [Back to Index](00-INDEX.md)

## 15.1 Future Improvements (Prioritized)

### Tier 1 — Infrastructure foundations (do first, unblocks everything else)
1. **Containerization + CI/CD**: add `Dockerfile`s for `backend/`/`frontend/`, a `docker-compose.yml` for local dev parity, and a GitHub Actions workflow running `typecheck`/`test`/`build`/`lint` on every PR. Currently **zero** deployment/CI infrastructure exists (see [13-deployment-config-dependencies.md](13-deployment-config-dependencies.md) §13.1).
2. **Background job scheduler** (e.g. `node-cron` or a lightweight queue): purge expired `refresh_tokens`, auto-transition overdue fees, auto-close expired feedback/result-entry windows, retry failed `workflow_logs`. See [12-performance-error-handling-workflow.md](12-performance-error-handling-workflow.md) §12.4.
3. **Object storage for uploads**: move `backend/uploads/{documents,lms}` off local disk to S3-compatible storage before any horizontal scaling — the current design silently loses files or serves inconsistent results across multiple instances (see [13](13-deployment-config-dependencies.md) §13.10).
4. **Socket.IO handshake authentication hardening**: verify the JWT presented at socket-connect time server-side before allowing a connection (see [07-authentication-and-security.md](07-authentication-and-security.md) §7.10).

### Tier 2 — Close the documented-vs-implemented business-rule gaps
5. **Fee-clearance / attendance-percentage gating for exam eligibility** — the single largest gap between the planning docs and the implemented system (see [11-business-logic-and-sync-matrix.md](11-business-logic-and-sync-matrix.md) §11.8). The Workflow Rule Engine's `condition` JSON is the natural mechanism to implement this without new schema.
6. **Attendance correction approval workflow** (maker-checker, 48-hour window) as originally specified — currently direct `PATCH` by any faculty/admin (§11.1).
7. **Academic year promotion / detention / ATKT-backlog tracking** — currently manual, one student at a time (§11.7).
8. **Revaluation workflow** as a distinct, audited process rather than a direct result `PATCH` (§8.11, §11.10).
9. **CGPA/SGPA aggregation** across subjects/semesters if the student dashboard is meant to show it (verify current behavior directly against `analytics.service.ts`/`dashboard.service.ts` before assuming it's missing vs. just undiscovered in this research pass).

### Tier 3 — Scale & robustness
10. **Redis (or equivalent shared cache)** to replace the in-process `ttlCache` once running more than one API instance — the current cache is per-process and would be inconsistent across replicas.
11. **Read replicas / connection-pool tuning** ahead of the documented 2000+ concurrent user target (`project_vision_and_requirements.md` §5) — untested at that scale.
12. **Structured logging** (winston/pino) + log aggregation, replacing console-only logging, before running multiple instances where correlating logs across processes matters.
13. **Frontend test coverage** — currently zero automated frontend tests exist; introduce Vitest/Jest + React Testing Library at minimum for `lib/permissions.ts` (RBAC logic) and `lib/api.ts` (refresh/retry logic), given how much of the security model lives there.
14. **Shared type generation** between frontend and backend (e.g. a shared package, or OpenAPI-generated client types) to eliminate the hand-maintained duplication noted in [04-frontend.md](04-frontend.md) §4.12.
15. **Toast/snackbar system** on the frontend to replace `alert()`/inline-banner error UX (§4.9).

### Tier 4 — Product expansion (per the original planning docs' aspirations)
16. **Library management module** (planning docs describe it; entirely unbuilt).
17. **Hostel & Transport modules** (unbuilt; planning docs note these should hook into the existing Student and Fee entities via FK, requiring no core schema rework).
18. **Parent/Guardian portal** (unbuilt; planning docs note it can be a read-only role mapped to existing Student IDs).
19. **Placement-drive workflow** beyond the current generic Opportunity Hub posting board (company/round tracking, eligibility-based shortlisting, resume management).
20. **Payment gateway integration** to replace manual "record payment" entry (explicit MVP exclusion, still true today).
21. **AI/predictive analytics** (at-risk-student prediction from attendance/marks trends, chatbot) — planning-doc aspiration, unbuilt; the append-only, immutable-ledger design of `attendance`/`internal_marks`/`results` (§6.5) is explicitly noted in the planning docs as good preparation for this, if pursued.
22. **Multi-language (i18n) support** — unbuilt.
23. **Biometric attendance integration** — unbuilt; planning docs note this could hit the same `/api/attendance` endpoint the web UI uses today, requiring no backend change, only a device-side integration.

## 15.2 Appendix — Glossary

| Term | Meaning in this system |
|---|---|
| **Teaching Assignment** | The record linking one faculty member to one subject+section+academic-year; the structural hub most transactional modules depend on |
| **Curriculum Mapping** | The join record placing a subject within a specific department/program/regulation/year/semester |
| **Result Entry Task** | A per-(exam, teaching-assignment) unit of work driving the entry→verify→publish approval chain for results |
| **Mentoring Head** | A faculty capability flag (`is_mentoring_head`) granting department-wide mentorship management, not a distinct role |
| **HOD** | Head of Department — a `faculty.designation` value, DB-uniqueness-enforced at one per department, not a distinct role |
| **Registry** | An internal, non-routed facade service consolidating a cross-module "master data" lookup (e.g. `studentRegistry`) to prevent duplicate ad hoc queries |
| **Workflow Rule / Workflow Engine** | The configurable, event-driven automation system (trigger → condition → action) distinct from the Result Entry Task's maker-checker approval chain |
| **Exam Session vs. Examination Session** | Two distinct tables — see [06-database.md](06-database.md) §6.3.10 — do not conflate |
| **Academic Session** | Not a real table — `students.academic_year` (a string) stands in for it; `teaching_assignments.academic_session_id` is a deliberate untyped placeholder for a possible future formal entity |
| **Soft delete** | `deleted_at TIMESTAMPTZ`, `NULL` = live row; deliberately absent on ledger tables (attendance, internal marks, fee payments) where corrections should be updates or new rows, not deletes |
| **Ownership model** | The convention that each database table has exactly one "owning" service; other modules read via that service or a Registry, not direct cross-table queries |
| **RBAC label** (frontend) | The richer, client-side-only role vocabulary (`Super Admin`, `College Admin`, `HOD`, `Academic Coordinator`, `Placement Officer`, `Mentoring Head`, `Faculty`, `Student`) used purely for UI nav-filtering — **not** backed by distinct database roles |
| **Simulation Context** | A legacy/demo local-state store (`localStorage`-persisted) that also doubles as the app's theme provider and a role-switch simulator — distinct from the real `AuthContext` session |

## 15.3 Appendix — Abbreviations

| Abbreviation | Meaning |
|---|---|
| ERP | Enterprise Resource Planning |
| RBAC | Role-Based Access Control |
| JWT | JSON Web Token |
| LMS | Learning Management System |
| ATKT | Allowed To Keep Terms (backlog/supplementary exam carry-forward) |
| HOD | Head of Department |
| CGPA/SGPA | Cumulative / Semester Grade Point Average |
| TTL | Time To Live (cache expiry) |
| CRUD | Create, Read, Update, Delete |
| FK / PK | Foreign Key / Primary Key |
| CSRF / XSS | Cross-Site Request Forgery / Cross-Site Scripting |
| SAD | Software Architecture Document (this document) |

## 15.4 Appendix — References

- In-repo planning documents: `project_vision_and_requirements.md`, `ARCHITECT_REVIEW.md`, `SYSTEM_MODEL.md`, `BUSINESS_RULES_AND_WORKFLOWS.md`, `MVP_DEFINITION_AND_DEVELOPMENT_ROADMAP.md`, `UI_UX_BLUEPRINT.md`, `walkthrough.md`, `README.md`.
- In-repo engineering notes: `docs/erp-integration-audit.md`, `docs/teaching-assignment-refactor-plan.md`.
- This document was produced by direct inspection of `frontend/src`, `backend/src`, and all 50 files in `backend/src/db/migrations/`, as of commit `184a34c`.

## 15.5 Appendix — Development Notes

- Route files consistently declare literal path segments before `/:id` — follow this convention for any new endpoint (see [09-api-documentation.md](09-api-documentation.md) §9.0).
- Every new mutating table should get a `deleted_at` column **unless** it is a genuine append-only ledger (attendance-like) — see [06-database.md](06-database.md) §6.5 for the existing precedent either way.
- New cross-module lookups should go through a Registry facade (or a new one should be added) rather than querying another module's table directly — see [05-backend.md](05-backend.md) §5.5.
- New business rules that need "if X then notify/create-event Y" behavior should be modeled as a `workflow_rules` row + a new `workflow_trigger_event`/`workflow_action_type` enum value where possible, rather than hardcoded into a service — this keeps the automation surface configurable (see [08-modules.md](08-modules.md) §8.21).

---

## 15.6 Undocumented or Missing Components

Per the documentation brief, this section explicitly lists everything that could **not** be documented because it does not exist in the codebase, or exists only as a stub/placeholder — rather than silently omitting it.

### Entirely missing (no code found)
- Library management module (catalog, checkout/return, fines).
- Hostel management module.
- Transport management module.
- Parent/Guardian portal or role.
- Placement Officer role and a dedicated placement-drive workflow (company/round tracking, resume management) — only the generic Opportunity Hub posting board exists.
- Payment gateway integration (fees are recorded manually only).
- Email/SMS notification delivery (notifications are in-app/Socket.IO only; no SMTP/Twilio-equivalent integration).
- Background job scheduler / cron / message queue of any kind.
- CI/CD pipeline (no `.github/workflows`), Dockerfile, docker-compose, or any deployment manifest.
- Frontend automated test suite (no Jest/Vitest/Playwright/Cypress configuration in `frontend/`).
- Backend ESLint configuration (backend has no lint config at all, only TypeScript strictness + tests).
- Multi-language / i18n support.
- Biometric hardware integration.
- AI/predictive analytics (at-risk student prediction, chatbot).
- Account lockout after repeated failed logins (only IP-based rate limiting exists).
- Scheduled purge of expired/revoked `refresh_tokens`.
- Generic department-scoped authorization middleware (HOD department-scoping is handled ad hoc per-service, not centrally).
- Formal Academic Session entity (`teaching_assignments.academic_session_id` exists as an untyped, unused-by-FK placeholder column).

### Partially implemented / stubbed
- **Bulk Academic Data Import**: only the Student entity-type strategy is implemented; Faculty/Subjects/Curriculum/Teaching-Assignment/Department/Classroom/Timetable/Exam-Schedule strategies are modeled in the `import_entity_type` enum and the `ImportStrategy` interface but throw `IMPORT_STRATEGY_NOT_IMPLEMENTED` if invoked (see [05-backend.md](05-backend.md) §5.15).
- **Timetable conflict detection**: a `POST /timetables/validate-input` endpoint exists, but whether it performs full faculty/room double-booking conflict detection (vs. structural validation only) was not confirmed against `timetable.service.ts` in this research pass — verify directly before relying on it (see [11-business-logic-and-sync-matrix.md](11-business-logic-and-sync-matrix.md) §11.6).
- **CGPA/SGPA computation**: no dedicated aggregation function was located; the student dashboard mockups in `UI_UX_BLUEPRINT.md` show a CGPA figure whose current backend source was not confirmed.
- **Workflow log retry**: `workflow_logs.status` includes a `retrying` value, but no actual retry-execution mechanism was found — it may require manual intervention today.
- **Fee-based / attendance-based exam eligibility gating**: schema and planning docs describe this; no enforcing code path was found in Examinations/Result services (see [11](11-business-logic-and-sync-matrix.md) §11.8 — the most significant gap flagged in this document).
- **Attendance correction approval workflow**: no correction-window timestamp or approval-queue table exists; corrections are a direct role-gated `PATCH`.
- **Socket.IO connection-time authentication**: a token is passed at handshake, but server-side verification of that token before accepting the connection was not confirmed in the middleware/server code reviewed — flagged as a security item to verify, not a confirmed vulnerability.
- **Revaluation & Supplementary-exam workflows**: `exam_type` enum includes `Supplementary Exam`/`Improvement Exam` values and `results` supports re-`PATCH`, but no distinct state machine, fee-linkage, or audit trail beyond generic `audit_logs` was found for either process.

### Superseded but retained (not "missing," but worth flagging as historical)
- `faculty_subject_assignments` — retained only as a read-only compatibility VIEW over `teaching_assignments`.
- `/api/subject-allocations` routes — retained only as a deprecated, zero-logic re-export of the Teaching Assignment module.
- `mentor_assignments` (legacy 1:1 mentorship) — retained alongside the newer `mentor_groups` model; both can theoretically apply to the same student simultaneously (see [11](11-business-logic-and-sync-matrix.md) §11.5).

This list should be treated as a living punch list — re-verify it against the codebase before using it to plan new work, since the system is under active development (most recent commits touch curriculum scheme and teaching assignments, per the repository's git log).
