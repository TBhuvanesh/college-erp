# 2. System Architecture & High-Level Architecture

← [Back to Index](00-INDEX.md)

## 2.1 Layered System Architecture

The system is a classic 3-tier web application: a Next.js client, a monolithic Express API, and a PostgreSQL database — plus a realtime side-channel (Socket.IO) and a handful of external delegation points (email/SMTP is referenced in planning docs but **not implemented**; there is no external payment gateway; PDF/Excel generation happens in-process).

```mermaid
flowchart TD
    subgraph Client["Frontend — Next.js 16 / React 19 (Client-Rendered)"]
        Pages["~90 role-scoped pages\n(app/admin, app/faculty, app/hod, app/student, app/accountant)"]
        Shell["DashboardLayout + Sidebar + TopHeader + BottomNav"]
        Ctx["Context layer:\nAuthContext · PermissionContext · SocketContext · SimulationContext"]
        ApiClient["lib/api.ts — apiFetch()\n(Bearer header injection, silent 401 refresh+retry)"]
    end

    subgraph EdgeMW["Express Global Middleware Stack (app.ts)"]
        Helmet["helmet() security headers"]
        Cors["cors() — credentialed, origin allowlist"]
        BodyParse["express.json (10mb) / urlencoded / cookie-parser"]
        ReqLog["requestLogger"]
        RateLimit["globalLimiter (1000 req/15min)\n+ authLimiter (10 req/15min on /login)"]
    end

    subgraph AuthLayer["Authentication & Authorization"]
        Authenticate["authenticate — verifies JWT, populates req.user\n(stateless: claims only, no per-request DB hit)"]
        Authorize["authorize() / requireRole() / requireSuperAdmin()\n+ mentorshipAuth.ts (record-level checks)"]
        Validate["validate() — Zod schema middleware"]
    end

    subgraph Business["Business Services (backend/src/services, 60 files)"]
        Controllers["42 Controllers — thin HTTP adapters"]
        Services["60 Services — business logic, one 'owning' service per table"]
        Registries["6 Registry facades — cross-module lookups\n(Student/Faculty/Academic/Curriculum/TeachingAssignment/Resource)"]
        Engines["Cross-cutting engines:\nworkflowEngine · timelineEngine · actionEngine · exportService · eventBus"]
    end

    subgraph Data["Data Layer"]
        Pool["pg Pool (max 10) + withTransaction()\nAsyncLocalStorage transaction context"]
        DB[("PostgreSQL — Neon serverless\n60 tables / 50 migrations")]
    end

    subgraph RT["Realtime"]
        SocketSrv["Socket.IO server\n(attached to same HTTP server)"]
    end

    subgraph Ext["External / Delegated (mostly NOT implemented)"]
        FS["Local filesystem — uploads/documents, uploads/lms"]
        NoGateway["No payment gateway (fees marked manually)"]
        NoSMTP["No email/SMS provider integrated"]
    end

    Pages --> Shell --> Ctx --> ApiClient
    ApiClient -->|HTTPS + Bearer JWT + httpOnly refresh cookie| Helmet
    Helmet --> Cors --> BodyParse --> ReqLog --> RateLimit --> Authenticate
    Authenticate --> Authorize --> Validate --> Controllers
    Controllers --> Services
    Services --> Registries
    Services --> Engines
    Services --> Pool --> DB
    Engines -->|eventBus.publish after commit| SocketSrv
    SocketSrv -->|realtime_event| Ctx
    Services -.->|uploadPdf / uploadLmsFile| FS
```

### Layer responsibilities

| Layer | Responsibility | Key files |
|---|---|---|
| **Frontend (Client)** | Renders role-scoped UI, holds session in memory, calls the API, subscribes to realtime events | `frontend/src/app/**`, `frontend/src/lib/api.ts` |
| **API Layer (Express routers)** | Declares URL surface, wires middleware chains, delegates to controllers | `backend/src/routes/*.ts` (43 files) |
| **Authentication** | Verifies JWT, issues/rotates tokens, hashes passwords | `middleware/authenticate.ts`, `utils/jwt.ts`, `utils/password.ts`, `services/auth.service.ts` |
| **Authorization** | Role/permission/record-level gating | `middleware/authorize.ts`, `middleware/mentorshipAuth.ts`, `types/roles.ts` |
| **Business Services** | Domain logic, one owning service per table, registries for cross-module reads | `backend/src/services/*.ts` (60 files), `backend/src/registries/*.ts` |
| **Database** | Persistent relational storage, enforced constraints/checks, soft-delete convention | `backend/src/db/migrations/*.sql` (50 files), `config/database.ts` |
| **External Services** | File storage (local disk only today); no payment/email/SMS providers wired up | `middleware/upload.ts`, `middleware/uploadLms.ts` |

---

## 2.2 High-Level Role Interaction Architecture

```mermaid
flowchart TD
    Admin(["Admin\n(+ Super Admin flag)"])
    HOD(["HOD\n(faculty designation='hod')"])
    Faculty(["Faculty\n(+ Mentoring Head flag)"])
    Student(["Student"])
    Accountant(["Accountant"])

    Admin -->|"provisions users, departments,\nsubjects, curriculum, fees,\nworkflow rules"| API
    HOD -->|"approves dept workload,\nreviews attendance/results,\nmentorship oversight"| API
    Faculty -->|"marks attendance, enters marks/\nresults, LMS materials/grading,\nteaching plans, mentorship notes"| API
    Student -->|"views attendance/results/fees,\nsubmits assignments/feedback,\nbookmarks opportunities"| API
    Accountant -->|"creates/updates fee records,\nrecords payments"| API

    API["Express API\n(routes → controllers → services)"] --> DB[("PostgreSQL")]
    DB -->|realtime push on commit| Socket["Socket.IO"]
    Socket -->|"ATTENDANCE_UPDATED, TEACHING_PLAN_CHANGED,\nEXAM_SEATING_CHANGED, NOTIFICATION_EMITTED"| Admin
    Socket --> HOD
    Socket --> Faculty
    Socket --> Student
    Socket --> Accountant
```

### Notes on the diagram
- HOD and Mentoring Head are **not separate accounts** — they are the same `faculty` role with a `designation`/flag, so the arrows above represent capability supersets over the base Faculty arrow, not a separate login experience.
- All five populations authenticate through the same `/api/auth/login` endpoint; the returned JWT's `role`/`designation`/`isSuperAdmin`/`facultyId`/`departmentId`/`studentId` claims are what differentiate downstream authorization (see [07-authentication-and-security.md](07-authentication-and-security.md)).
- The Accountant role is the most narrowly scoped — it only reaches the Fees module and its own dashboard (`app/accountant/{dashboard,fees}` — only 2 frontend routes exist for this role, vs. ~27 for Admin).

---

## 2.3 Frontend Layout Composition (per-role)

```mermaid
flowchart LR
    RootLayout["app/layout.tsx\n(fonts, metadata, AppProviders)"] --> Providers

    subgraph Providers["AppProviders.tsx composition (outer→inner)"]
        QC["QueryClientProvider"] --> Sim["SimulationProvider\n(theme + legacy mock store + role-switch sim)"]
        Sim --> Auth["AuthProvider"]
        Auth --> Sock["SocketProvider"]
        Sock --> Perm["PermissionProvider"]
        Perm --> RTL["RealtimeSyncListener\n(useRealtimeSync)"]
    end

    RTL --> RoleLayout

    subgraph RoleLayout["Per-role layout.tsx (admin/faculty/hod/student/accountant)"]
        PR["ProtectedRoute\n(allowedRoles gate)"] --> AG["AccessGuard\n(path-level RBAC, all roles except accountant)"]
        AG --> DL["DashboardLayout\n(Sidebar + TopHeader + BottomNav)"]
    end

    DL --> Page["Role-specific page.tsx"]
```

See [04-frontend.md](04-frontend.md) for full detail on each box.

---

## 2.4 Request Lifecycle (single API call, end to end)

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant FE as Next.js Page
    participant API as lib/api.ts (apiFetch)
    participant EX as Express (app.ts middleware)
    participant MW as authenticate/authorize/validate
    participant C as Controller
    participant S as Service
    participant DB as PostgreSQL
    participant EB as eventBus / Socket.IO

    U->>FE: interacts (e.g. clicks "Mark Attendance")
    FE->>API: apiFetch('/attendance/sessions', {method:'POST', body})
    API->>EX: fetch() with Authorization: Bearer <accessToken>
    EX->>EX: helmet → cors → json parser → cookieParser → requestLogger → rateLimiter
    EX->>MW: authenticate (verify JWT, populate req.user)
    alt token expired
        MW-->>API: 401 TOKEN_INVALID
        API->>EX: POST /auth/refresh (httpOnly cookie)
        EX-->>API: new access token
        API->>EX: retry original request once
    end
    MW->>MW: authorize('attendance:create') / requireRole('faculty')
    MW->>MW: validate(zodSchema) on body/params/query
    MW->>C: req.user, validated req.body
    C->>S: attendanceService.markAttendance(...)
    S->>DB: withTransaction(client => INSERT/UPSERT ... )
    DB-->>S: rows
    S-->>EB: (after commit) eventBus.publish('ATTENDANCE_UPDATED', payload)
    EB-->>U: Socket.IO push to subscribed clients (React Query cache invalidation)
    S-->>C: result
    C-->>EX: sendSuccess(res, data)
    EX-->>API: { success: true, data }
    API-->>FE: typed response
    FE-->>U: UI updates (toast/inline state — no shared toast library)
```
