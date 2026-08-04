# 4. Frontend Documentation

← [Back to Index](00-INDEX.md)

The frontend is a Next.js 16 (App Router) application, effectively operating as a **client-rendered SPA** that calls an external Express API — `next.config.ts` is default/empty, there are no server actions, API routes, or SSR data-fetching patterns in use; every page is a `"use client"` component fetching data imperatively after mount.

## 4.1 Root & Role Layouts

`frontend/src/app/layout.tsx` (server component) sets up `Inter`/`Outfit` Google Fonts as CSS variables, global metadata ("Sreyas College ERP - Academic Portal"), imports `globals.css`, and wraps `{children}` in the single `<AppProviders>` composition root.

Each role subtree has its own `layout.tsx`, all client components with an almost identical shape:

```
ProtectedRoute (role gate) → AccessGuard (path-level RBAC) → DashboardLayout (chrome) → {children}
```

| Layout | `allowedRoles` | Extra logic |
|---|---|---|
| `app/admin/layout.tsx` | `["admin"]` | — |
| `app/faculty/layout.tsx` | `["faculty"]` | — |
| `app/hod/layout.tsx` | `["faculty"]` | `useEffect` double-checks `user.designation === "hod"`, else redirects `/` — **HOD is scoped at the `ProtectedRoute` level as plain "faculty"**; the HOD/faculty split happens later via `AccessGuard` + `PermissionContext` |
| `app/student/layout.tsx` | `["student"]` | — |
| `app/accountant/layout.tsx` | `["accountant"]` | **Does not wrap `AccessGuard`** — only `ProtectedRoute` + `DashboardLayout`, unlike the other four roles |

⚠ **Note**: No `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`, or `app/global-error.tsx` exist anywhere in the tree — Next.js route-level error/loading boundaries are **not used**; all loading/error UI is handled ad hoc inside individual components.

## 4.2 Authentication Flow

**Login page** (`frontend/src/app/page.tsx`, root `/`): a single controlled-input form calling `useAuth().login(username, password)`. On success, a `useEffect` watching `user` redirects by role: `admin → /admin/dashboard`; `faculty` (designation `hod` → `/hod/dashboard`, else `/faculty/dashboard`); `student → /student/dashboard`; `accountant → /accountant/dashboard`.

**`AuthContext.tsx`** (`frontend/src/context/AuthContext.tsx`):
- Holds `user` (with nested `facultyProfile`/`studentProfile`), `accessToken`, `loading` — **all in React state, never in `localStorage`**. `localStorage` only stores a boolean hint `erp_has_session = "true"` used to attempt silent refresh on load.
- **Session bootstrap**: on mount, if the hint is set, calls `POST /auth/refresh` with `credentials: "include"` (relying on the httpOnly refresh cookie); on success, populates token/user and syncs into `SimulationContext`.
- Listens for two custom `window` events dispatched by `lib/api.ts`: `tokenRefreshed` (keeps context in sync after a silent refresh triggered by a 401) and `sessionExpired` (clears state when refresh fails).
- `logout()` calls `POST /auth/logout`, clears state + the localStorage hint, and hard-navigates to `/` via `window.location.href`.

**`lib/api.ts`** (`apiFetch<T>(endpoint, options, accessToken?)`):
- Attaches `Authorization: Bearer <token>` (explicit arg or module-level `globalAccessToken` fallback); auto-sets `Content-Type: application/json` unless the body is `FormData`.
- **Silent refresh-and-retry**: on a 401 (except for `/auth/refresh`/`/auth/login` themselves) it calls `POST /auth/refresh`, updates the token, dispatches `tokenRefreshed`, and retries the original request once. On refresh failure it dispatches `sessionExpired`.
- Network failures return a soft `{success:false, message:"Backend server is currently offline..."}` object instead of throwing, so callers can render inline errors rather than crash.
- `API_URL` defaults to `http://127.0.0.1:3001/api` via `NEXT_PUBLIC_API_URL`.

**Socket auth** (`context/SocketContext.tsx`): connects `socket.io-client` to `NEXT_PUBLIC_SOCKET_URL` passing `auth: { token: accessToken }`; reconnects whenever `accessToken`/`user` change.

## 4.3 Role Protection (3 layers, defense in depth)

1. **`components/ProtectedRoute.tsx`** — coarse role gate. Shows a full-screen "Verifying Identity Session..." spinner while `loading`; redirects to `/` if no `user`, or if `allowedRoles` is given and `user.role` isn't in it.
2. **`components/Analytics/AccessGuard.tsx`** — fine-grained path gate (inside `ProtectedRoute` in every layout except accountant). Uses `usePermission().hasAccess(pathname)`; redirects to `/unauthorized` if denied.
3. **`context/PermissionContext.tsx`** + **`lib/permissions.ts`** — the RBAC engine:
   - `getRbacRole()` resolves a fine-grained label (`Super Admin`, `College Admin`, `HOD`, `Academic Coordinator`, `Placement Officer`, `Mentoring Head`, `Faculty`, `Student`) from `user.role` + `facultyProfile.designation` + email, further overridable by the legacy `SimulationContext.currentRole` selector.
   - `hasAccessToPath(role, path)` — hardcoded string-prefix/allowlist rules per RBAC label.
   - `hasAccessToWidget(role, widgetName)` — same idea for dashboard widget visibility.
   - Also drives `components/Sidebar.tsx`'s nav-item filtering.

⚠ **Note**: no root-level `middleware.ts` exists — route protection is entirely client-side/component-based, not edge middleware. A determined client could briefly see a flash of protected route structure before the client-side redirect fires (standard SPA-auth caveat).

## 4.4 Page Routes by Role

Full path listing is in [03-folder-structure.md](03-folder-structure.md). Route counts: **Admin 27**, **Faculty 18**, **HOD 12** (+ reuses several `/faculty/*` routes for teaching-workload duties per `Sidebar.tsx`'s "Teaching Desk" nav group), **Student 17**, **Accountant 2**. Total ≈ 76 distinct top-level page routes plus dynamic segments (`[subjectId]`, `[id]`, `[groupId]`, `[groupId]/[studentId]`).

Representative purpose per role (full table in [03-folder-structure.md](03-folder-structure.md)):
- **Admin**: system-wide CRUD registries (students/faculty/accountants/subjects/departments via courses), curriculum configuration, teaching-assignment allocation, timetable/exam/seating management, fee oversight, workflow/settings configuration, bulk import wizard.
- **Faculty**: personal teaching workspace — today's schedule, attendance marking, gradebook (internal marks + results), LMS content/grading, teaching-plan tracker, invigilation duty, mentorship group dashboard.
- **HOD**: department-scoped oversight dashboards (workload charts, teaching-progress cards, action center) plus the shared faculty teaching-workspace routes.
- **Student**: read-mostly consumption views (attendance, results, fees, timetable, LMS, seating) plus write actions limited to assignment submissions, feedback, and opportunity bookmarks.
- **Accountant**: fee ledger and dashboard only.

## 4.5 Shared Component Architecture

**Top-level `components/`** (cross-role chrome): `DashboardLayout.tsx` (sidebar+header+bottom-nav shell + mobile drawer with "Reset Simulation Data"/logout), `Sidebar.tsx` (role-aware collapsible nav, builds separate `adminNav`/`facultyNav`/`studentNav`/`hodNav`/`accountantNav` arrays filtered through `usePermission().hasAccess()`), `TopHeader.tsx` (page title, `GlobalSearch`, theme toggle, notification bell dropdown), `BottomNav.tsx` (mobile tab bar), `ProtectedRoute.tsx`, `CalendarView.tsx` / `EventFormModal.tsx` / `PersonalEventModal.tsx` (calendar building blocks reused across 4 roles), `NotificationCenter.tsx` (full inbox: tabs, filters, pagination, mark read/unread), `FacultyFormDrawer.tsx`/`StudentFormDrawer.tsx` (registry CRUD drawers), `DeleteConfirmationModal.tsx`/`FacultyDeleteModal.tsx`, `OpportunityCard.tsx`/`OpportunityFilterBar.tsx`/`OpportunityFormModal.tsx`, `PDFUploadModal.tsx`.

**Domain subfolders** (full listing in [03-folder-structure.md](03-folder-structure.md)): `Analytics/` (RBAC widget gating + charts), `Dashboard/` (KPI cards, activity feeds, workload charts — mostly Recharts-based), `Feedback/` (campaign lifecycle + student submission wizard), `LMS/` (subject LMS view + 4 modals), `Profile/`, `Search/` (`GlobalSearch`), `Seating/` (exam seating designer), `SubjectAllocation/`, `Subjects/` (catalog manager), `TeachingAssignment/`, `UX/` (generic primitives: `ConfirmationDialog`, `EmptyState`, `SkeletonLoaders`, `UnifiedPagination`, `UnifiedSearchBar`), `UXL/` (higher-level dashboard UX widgets used heavily by HOD/Faculty dashboards: `ActionCenter`, `QuickActions`, `SmartProgressCard`, `TodayFocus`, `UnifiedTimeline`).

## 4.6 Hooks, Lib, Providers, Context, Types

| Folder/file | Purpose |
|---|---|
| `hooks/useRealtimeSync.ts` | Subscribes to the Socket.IO `realtime_event` channel; invalidates matching React Query keys on `ATTENDANCE_UPDATED`/`TEACHING_PLAN_CHANGED`/`EXAM_SEATING_CHANGED`; does recipient-matching (by userId/role/department/semester) and fires DOM events on `NOTIFICATION_EMITTED`. Mounted once globally via `RealtimeSyncListener` in `AppProviders`. |
| `hooks/useRegistry.ts` | Shared React Query hooks wrapping `apiFetch`: `useStudents`, `useFaculty`, `useDepartments`, `useAcademicSessions` (client-computed), `useSections`, `useSubjects`, `useTeachingAssignments`, `useClassrooms`, `usePrograms` — all gated on `enabled: !!accessToken`. |
| `lib/api.ts` | Core fetch wrapper (§4.2) |
| `lib/permissions.ts` | RBAC engine (§4.3) |
| `lib/lms.ts`, `lib/opportunities.ts`, `lib/search.ts`, `lib/profile.ts`, `lib/seating.ts`, `lib/teachingPlan.ts`, `lib/feedback.ts`, `lib/mentorship.ts` | Per-domain TypeScript type definitions (no runtime logic beyond a few pure helpers, e.g. `seating.ts`'s `departmentColorClasses()`) |
| `providers/AppProviders.tsx` | Composition root: `QueryClientProvider` (staleTime 60s, no refetch-on-focus) → `SimulationProvider` → `AuthProvider` → `SocketProvider` → `PermissionProvider` → `RealtimeSyncListener` → children |
| `context/AuthContext.tsx` | Real backend session (§4.2) |
| `context/SimulationContext.tsx` | **Legacy/demo local-state store**, `localStorage`-persisted (`erp_students`, `erp_faculty`, `erp_invoices`, etc.), holding mock CRUD records + a `resetDatabase()`; also doubles as the **global theme provider** (`theme`/`toggleTheme`) and the **role-switch simulator** (`currentRole`) consumed by `Sidebar`/`PermissionContext` |
| `context/SocketContext.tsx` | Socket.IO client connection (§4.2) |
| `context/PermissionContext.tsx` | RBAC engine wiring (§4.3) |
| `types/*.ts` | `opportunity.ts`, `subject.ts`, `academicImport.ts`, `realtime.ts` (the `RealtimeEvent` union consumed by `useRealtimeSync`), `subjectAllocation.ts` |

## 4.7 State Management

- **No Redux/Zustand/Jotai** — confirmed absent from `package.json`.
- **Server/remote state**: split between a handful of shared "registry" lookups on React Query (`hooks/useRegistry.ts`) and — for the large majority of the ~90 pages — **plain imperative `apiFetch` calls inside `useEffect`/`useCallback` with local `useState`** for data/loading/error, even though React Query is globally available. React Query's cache is still used as an invalidation target by `useRealtimeSync` even for manually-fetched data (via a parallel custom-event mechanism).
- **Client/global state**: React Context exclusively (`AuthContext`, `SimulationContext`, `PermissionContext`, `SocketContext`).
- **Realtime sync**: Socket.IO events drive both React Query invalidation and custom `window` `CustomEvent`s (`realtimeDashboardUpdate`, `newRealtimeNotification`, `tokenRefreshed`, `sessionExpired`) that decouple `lib/api.ts` / `useRealtimeSync` / `NotificationCenter` / `TopHeader` without prop drilling.

## 4.8 Forms & Validation

**No react-hook-form and no zod** on the frontend — forms are plain controlled inputs (`useState` per field). Validation is manual/inline (e.g. login page checks `!username.trim()`) or relies on native HTML `required` attributes and server-side errors surfaced from `apiFetch`'s thrown `Error`. No shared form-schema library or generic `<Form>` abstraction exists — each modal/drawer (`StudentFormDrawer`, `FacultyFormDrawer`, `EventFormModal`, `OpportunityFormModal`, `CampaignForm`, etc.) implements its own local state and submit handler.

## 4.9 Error Handling & Loading States

- No Next.js error/loading boundaries (§4.1) — all handled inside components.
- **Loading**: ad hoc `Loader2` spinners (`ProtectedRoute`'s "Verifying Identity Session...", `AccessGuard`'s "Verifying Access Rights..."), plus dedicated skeletons in `components/UX/SkeletonLoaders.tsx` (`SkeletonTable`, `SkeletonCard`, `SkeletonDropdown`) used in list-heavy admin pages.
- **Empty states**: `components/UX/EmptyState.tsx` — generic icon/title/description/CTA card.
- **Destructive-action confirmation**: `components/UX/ConfirmationDialog.tsx` (generic) plus `DeleteConfirmationModal.tsx`/`FacultyDeleteModal.tsx` (entity-specific).
- **Error surfacing**: inline styled error banners built from local `error` string state; some destructive actions fall back to browser `alert(err.message)`.
- ⚠ **No toast/snackbar library or shared toast component exists** (no `react-hot-toast`/`sonner`/custom provider) — user feedback is either an inline banner, `alert()`, or `confirm()` (used for "Reset Simulation Data"/"Reset Database" actions).
- `lib/api.ts` centralizes one class of error handling: network failure → soft `{success:false}` object; non-2xx → thrown `Error`, caught in local `try/catch` around each `apiFetch` call site.

## 4.10 Caching

- React Query default `staleTime: 60s`, `refetchOnWindowFocus: false` (set in `AppProviders`).
- `hooks/useRegistry.ts` tunes `staleTime` per resource type (e.g. departments/programs rarely change → longer staleTime than teaching assignments).
- Backend-side, `utils/ttlCache.ts` provides a parallel in-process TTL cache for expensive read aggregations (dashboards/analytics) — see [05-backend.md](05-backend.md).
- No service worker / offline cache / CDN-level caching is configured anywhere in the stack.

## 4.11 Responsive Design

Mobile-first, per `UI_UX_BLUEPRINT.md` (still accurate to the implementation): sidebar hidden below 1024px in favor of a sticky bottom nav (`BottomNav.tsx`) + slide-up drawer; two-column dashboard grids on tablet; full multi-column + hover states + `Cmd/Ctrl+K` global search on desktop. Status badges, metric cards, and responsive data tables (desktop table ↔ mobile card-list collapse) are the primary reusable responsive primitives — see `UI_UX_BLUEPRINT.md` §7/§8 for the full design-token specification (colors, radii, shadows) which is implemented via Tailwind utility classes rather than a separate design-token file.

## 4.12 Frontend Architecture Summary

The frontend intentionally has **no backend-for-frontend layer** — Next.js's own API-route capability is unused; it is a pure client calling the Express API directly via `NEXT_PUBLIC_API_URL`. This keeps the two codebases fully decoupled (any client could replace the Next.js frontend without backend changes) at the cost of duplicating some type definitions between `frontend/src/lib/*.ts` / `frontend/src/types/*.ts` and `backend/src/types/*.ts` (no shared/generated types package exists — see [15-future-and-appendix.md](15-future-and-appendix.md) for this as a noted improvement opportunity).
