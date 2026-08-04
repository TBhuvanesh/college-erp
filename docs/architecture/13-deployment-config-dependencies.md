# 13. Deployment, Configuration Files & Dependencies

← [Back to Index](00-INDEX.md)

## 13.1 Deployment — Current State

⚠ **No deployment infrastructure exists in this repository today.** An exhaustive search found no `Dockerfile`, no `docker-compose.yml`, no `.github/workflows/` (no CI/CD pipeline at all), no `Procfile`, no `vercel.json`/`railway.json`/`render.yaml`, and no deployment shell scripts anywhere in the repo. This is a real gap, not an oversight in this document — treat it as the top infrastructure item in [15-future-and-appendix.md](15-future-and-appendix.md).

What *does* exist and hints at the intended deployment target:
- `backend/src/config/database.ts` special-cases SSL for connection strings containing `neon.tech`, strongly implying **Neon serverless Postgres** is the actual/intended production database.
- `backend/package.json` scripts are a standard compile-then-run Node process: `build` (`tsc`) → `start` (`node dist/server.js`) — no serverless-function wrapper, no bundler.
- `frontend`'s standard Next.js `build`/`start` scripts — a natural fit for Vercel, though no `vercel.json` commits to that.
- `.env.example` (backend only) documents every required runtime environment variable (§13.3).

### Recommended target architecture (not yet implemented)
A reasonable next step — one Dockerfile per service (`backend/Dockerfile`, `frontend/Dockerfile`), a `docker-compose.yml` for local dev parity (app + local Postgres), and a GitHub Actions workflow running `typecheck`/`test`/`build` on every PR — is discussed further in [15-future-and-appendix.md](15-future-and-appendix.md).

## 13.2 Environments

| Environment | How it's distinguished | Notes |
|---|---|---|
| Development | `NODE_ENV=development` (default) | SQL query logging enabled (`config/database.ts`); refresh cookie `secure:false` |
| Test | `NODE_ENV=test` | Used by Jest config (`tsconfig.test.json`); error messages exposed in responses |
| Production | `NODE_ENV=production` | Refresh cookie `secure:true`; internal error messages hidden from API responses (generic `INTERNAL_ERROR` only) |

## 13.3 Environment Variables (`backend/.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Environment switch (§13.2) |
| `PORT` | `3001` | Backend HTTP port |
| `DATABASE_URL` | — (required) | Postgres connection string; presence of `neon.tech` or `sslmode=` auto-enables SSL |
| `JWT_ACCESS_SECRET` | — (required, min 32 chars) | Access-token signing secret |
| `JWT_REFRESH_SECRET` | — (required, min 32 chars) | Refresh-token signing secret (separate from access) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access-token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh-token TTL |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor (bounded 10–14 by Zod) |
| `CORS_ORIGIN` | `http://localhost:3000` | Comma-separated allowlist |
| `RATE_LIMIT_WINDOW_MS` | `900000` | ⚠ Defined but not actually read by `rateLimiter.ts` (vestigial) |
| `RATE_LIMIT_MAX` | `100` | ⚠ Same — vestigial |
| `UPLOAD_DIR` | `uploads/documents` | Document upload target — ⚠ not documented in `.env.example` despite being in the Zod schema |
| `LMS_UPLOAD_DIR` | `uploads/lms` | LMS file upload target — ⚠ same gap |

**Frontend**: `NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:3001/api`), `NEXT_PUBLIC_SOCKET_URL` (defaults to `http://127.0.0.1:3001`) — set via `frontend/.env.local` (not committed; no `.env.example` was found on the frontend side).

Invalid or missing required env vars cause the backend to `process.exit(1)` at boot with per-field Zod error messages logged — a deliberate fail-fast design.

## 13.4 Build Tools

| Tool | Where used | Purpose |
|---|---|---|
| `tsc` | Backend (`npm run build`) | Compiles `backend/src` → `backend/dist` (CommonJS, ES2022 target) |
| `tsx` | Backend (`npm run dev`) | Hot-reload dev runner (`tsx watch src/server.ts`); also used for one-off DB scripts (`migrate`, `seed`, `sync-excel-rolls`) |
| Next.js's own bundler | Frontend (`npm run build`/`dev`) | No custom Webpack/Turbopack config beyond Next.js defaults (`next.config.ts` is empty) |
| `jest` + `ts-jest` | Backend only | 20 service-level test files (`backend/src/__tests__/`), no supertest/HTTP-level integration tests found |

## 13.5 Package Managers

Both `frontend/` and `backend/` are independent npm packages with their own `package.json`/`package-lock.json`/`node_modules` — there is no monorepo tool (no Nx/Turborepo/Lerna/npm workspaces) tying them together. Shared type definitions between frontend and backend are **not** generated/shared — they're maintained by hand in parallel (`frontend/src/lib/*.ts` / `frontend/src/types/*.ts` vs `backend/src/types/*.ts`), a duplication risk noted in [04-frontend.md](04-frontend.md) §4.12.

## 13.6 Development Tools

- **`tsx`** — backend dev/hot-reload and script runner.
- **ESLint 9** (flat config) — **frontend only**; extends `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`, downgrades `@typescript-eslint/no-explicit-any` and `@typescript-eslint/no-unused-vars` to warnings. ⚠ **The backend has no ESLint configuration at all** — code quality there is enforced solely by TypeScript's strict compiler flags (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, all `true`) and the Jest test suite.
- **VS Code / any IDE** — no `.vscode/` workspace settings or recommended-extensions file was found.

## 13.7 Version Control

Git, single repository containing both `frontend/` and `backend/` (a "polyrepo-in-a-monorepo-folder" layout rather than a true monorepo tool). Current branch: `main`. No branch-protection or PR-template configuration files (`.github/`) exist.

## 13.8 Configuration Files — Full Inventory

| File | Purpose |
|---|---|
| `backend/package.json` | Scripts: `dev`, `build`, `start`, `migrate`, `seed`, `sync-excel-rolls`, `typecheck`, `test`/`test:watch`/`test:coverage`. Dependencies grouped in §13.9. |
| `backend/tsconfig.json` | `target: ES2022`, `module: CommonJS`, `strict: true` + all extra strictness flags, `rootDir: ./src`, `outDir: ./dist`, excludes `__tests__` (built separately) |
| `backend/tsconfig.test.json` | Extends base config, adds `jest`/`node` types, relaxes unused-vars/params checks for test code |
| `backend/jest.config.js` | `testEnvironment: node`, `roots: ['<rootDir>/src']`, `testMatch: ['**/__tests__/**/*.test.ts']`, `ts-jest` via `tsconfig.test.json`, `clearMocks: true` |
| `backend/.env.example` | Documents all required/optional env vars (§13.3) |
| `frontend/package.json` | Scripts: `dev`, `build`, `start`, `lint`. Dependencies grouped in §13.9. |
| `frontend/tsconfig.json` | `target: ES2017`, `module: esnext`, `moduleResolution: bundler`, `jsx: react-jsx`, `noEmit: true` (Next handles bundling), path alias `@/* → ./src/*` |
| `frontend/next.config.ts` | Essentially empty (`const nextConfig: NextConfig = {}`) — no rewrites/redirects/headers/image domains/experimental flags |
| `frontend/eslint.config.mjs` | Flat config, extends Next's core-web-vitals + typescript configs, 2 rules downgraded to warn |
| `frontend/postcss.config.mjs` (implied by `@tailwindcss/postcss` dependency) | TailwindCSS 4 PostCSS pipeline |

## 13.9 Dependencies (Grouped by Purpose, with Rationale)

### Backend (`backend/package.json`)

| Group | Packages | Why they're there |
|---|---|---|
| Web framework | `express ^4.21.0` | HTTP server & routing |
| Real-time | `socket.io ^4.8.3` | Push updates for attendance/teaching-plan/exam-seating/notifications |
| Database | `pg ^8.12.0` | Raw Postgres client — no ORM is used anywhere |
| Auth | `jsonwebtoken ^9.0.2`, `bcryptjs ^2.4.3`, `cookie-parser ^1.4.6` | JWT sign/verify, password hashing, refresh-cookie parsing |
| Validation | `zod ^3.23.8` | Request schema validation, env var validation |
| Security/middleware | `helmet ^8.0.0`, `cors ^2.8.5`, `express-rate-limit ^7.4.0` | Security headers, CORS, brute-force/DoS mitigation |
| File processing | `multer ^2.2.0`, `exceljs ^4.4.0`, `pdfkit ^0.19.1`, `pdf-parse ^2.4.5` | Uploads, Excel/CSV read+write (imports/exports), PDF generation (reports/documents), PDF text extraction (academic-calendar auto-parsing) |
| Utilities | `uuid ^10.0.0`, `dotenv ^16.4.5` | Random ID generation (upload filenames), env loading |
| Dev/Test/Build | `typescript ^5.5.0`, `tsx ^4.16.0`, `jest ^29.7.0`, `ts-jest ^29.4.11`, `@types/jest`, plus `@types/*` for bcryptjs/cookie-parser/cors/express/jsonwebtoken/multer/node/pdf-parse/pdfkit/pg/uuid | Type-checking, dev hot-reload, unit testing |

Notably **absent**: no ORM, no logging library (winston/pino — console-only), no job-queue library, no Redis client, no HTTP-mocking/integration-test library (tests are service-level unit tests, not endpoint-level).

### Frontend (`frontend/package.json`)

| Group | Packages | Why they're there |
|---|---|---|
| Framework | `next 16.2.9`, `react 19.2.4`, `react-dom 19.2.4` | Core app framework |
| Data fetching/state | `@tanstack/react-query ^5.101.4` | Partial server-state caching (§4.7) |
| Real-time | `socket.io-client ^4.8.3` | Consumes backend Socket.IO push events |
| UI/Charts | `recharts ^3.9.0`, `lucide-react ^1.18.0` | Dashboard/analytics visualizations, icon set |
| Styling | `tailwindcss ^4`, `@tailwindcss/postcss ^4` (dev) | Utility-first CSS |
| Dev/Build/Lint | `typescript ^5`, `@types/node ^20`, `@types/react ^19`, `@types/react-dom ^19`, `eslint ^9`, `eslint-config-next 16.2.9` | Type-checking, linting |

Notably **absent**: no form library (react-hook-form/Formik), no client-side schema validation (no zod on the frontend despite the backend using it — §4.8), no dedicated auth/cookie library, **no test runner/testing-library configured at all** (no jest/vitest config anywhere in `frontend/`), no state-management library beyond React Query + Context.

## 13.10 Server Requirements (inferred, not documented anywhere in-repo)

- **Node.js** — a version compatible with TypeScript 5.5 / ES2022 target and Next.js 16 / React 19 (Node 20+ recommended based on `@types/node ^20`).
- **PostgreSQL** — any version supporting the SQL features used (JSONB, array columns, partial/composite unique indexes, `uuid-ossp` extension) — effectively any modern Postgres (13+).
- **Persistent local disk** for `backend/uploads/{documents,lms}` — ⚠ this means a horizontally-scaled or ephemeral-filesystem deployment (e.g. multiple stateless containers, or a PaaS with an ephemeral filesystem) would **lose uploaded files** or serve inconsistent results across instances unless uploads are moved to shared/object storage first. This is a concrete pre-requisite for any horizontal scaling of the backend.
- **Outbound network access** to the Postgres host (Neon) and nothing else — no other external service (email/SMS/payment gateway) is called from the backend today.
