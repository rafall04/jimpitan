# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Orientation

JIMPITAN is a multi-tenant financial-management platform for Indonesian RT neighborhood units (each tenant is an "RT", identified by `rtId`). It tracks the *jimpitan* community collection workflow, a cash ledger, expense approvals, and a public transparency site, with a Telegram bot as an alternate input channel.

**Read `SYSTEM_MAP.md` first.** It is the authoritative, maintained map of the whole workspace. Each major directory also has a `.module_map.md` describing its boundaries and safe edit order, and `docs/` holds per-module contract notes. Prefer these over re-deriving structure from scratch.

This is an npm-workspace-style monorepo (single root `package.json`, no separate per-app manifests):
- `apps/api` — NestJS REST API + the background worker (same source tree, two entrypoints).
- `apps/web` — Next.js (App Router) public site + private dashboard.
- `prisma/` — single Prisma schema + migrations (Postgres). The schema is the source of truth for the domain.
- `infrastructure/`, `compose.*.yaml`, `scripts/` — Docker/Nginx deployment and operational gates.
- `tests/` — Playwright E2E + runtime smoke skeletons. Unit tests are colocated with source as `*.spec.ts`.

## Working efficiently (token discipline)

This repo is heavily mapped and doc-headered **on purpose** — exploit that instead of rediscovering structure:

- **Jump, don't explore.** For hot/high-risk paths (finance posting, auth, the guard pipeline, BFF, worker), `docs/hot-paths.md` maps concern → exact `file:symbol` — open that one location. For broader "where is X", read `SYSTEM_MAP.md` + the relevant `.module_map.md` / `docs/` note first. A file's `Purpose/Caller/Deps` header usually answers "what is this" without reading the body.
- **Read narrowly.** Prefer `Grep` + targeted `Read` (offset/limit) over whole-file reads. The big files rarely need a full pass — e.g. `apps/api/src/modules/finance/infrastructure/prisma-finance.repository.ts` (~1500 lines), `prisma/schema.prisma` (~885).
- **Reserve multi-agent fan-out for audits / broad reviews**, not routine features or fixes — for those, a single focused agent or direct edits cost far less.
- **Tier the model:** Sonnet-tier subagents for exploration and mechanical edits; reserve Opus for design, security, and ledger/finance-correctness work.
- **Verify with the right gate, not by re-reading.** `npm run typecheck:web` / `build:api` catch type breaks; `scan:imports` / `infra:check` / `readiness:check` catch theirs. Run the specific gate instead of re-reading broadly to self-check.

## Commands

```bash
npm install
npm run prisma:generate        # generate Prisma client (uses a placeholder DB URL; no real DB needed)
npm run prisma:validate        # validate schema only

npm run build:api              # tsc -> dist/apps/api (also type-checks the API + worker)
npm run build:worker           # same tsconfig as build:api
npm run build:web              # next build
npm run typecheck:web          # tsc --noEmit for the frontend

npm run test:api               # vitest, scoped to apps/api/src
npm run test:web               # vitest, scoped to apps/web/src
npm run dev:web                # next dev (frontend only)
```

Run a single unit test (Vitest) by passing a path or `-t` name filter to the scoped script — do not drop the `--dir`, or Vitest will try to collect the whole repo:

```bash
npx vitest run --dir apps/api/src apps/api/src/modules/auth/application/auth.service.spec.ts
npx vitest run --dir apps/web/src -t "login form"
```

Gates / operational checks. CI (`.github/workflows/ci.yml`) runs the full sequence on every PR — `prisma:generate` → `prisma:validate` → `test:api` → `test:web` → `typecheck:web` → `build:api` → `build:worker` → `build:web` — and then these static gates, in this order:

```bash
npm run scan:imports           # fails on import cycles
npm run infra:check            # static production-infra safety (incl. Prisma engine target)
npm run readiness:check        # production readiness/security static gate
npm run docker:config:prod     # validate compose.prod.yaml renders
npm run test:e2e               # Playwright; no-ops unless E2E_* env is set (see docs/testing/e2e.md)
```

`npm run test:smoke` (runtime HTTP smoke; no-ops unless smoke URLs are set) and `npm run deploy:verify` are deploy-time checks — **not** part of CI.

There is **no `lint` script** — `eslint-config-next` is installed but not wired to a command. Type-checking (`build:api`, `typecheck:web`) is the de-facto static check.

The API binary also exposes a one-shot first-admin bootstrap CLI (`npm run bootstrap:admin` after a build); see `docs/deployment/first-admin-bootstrap.md`.

## API architecture (hexagonal / ports-and-adapters)

Every module under `apps/api/src/modules/<name>` follows the same four-layer split — match it when adding code:

- `presentation/` — controllers, request DTOs (class-validator), Swagger. The HTTP edge.
- `application/` — services, `*.use-cases.ts`, `*.commands.ts`. Orchestration + transactions live here.
- `domain/` — enums, policies, state machines, permission constants, business rules. No framework imports.
- `infrastructure/` — `*.port.ts` interfaces and their adapters (`prisma-*.repository.ts`, JWT, bcrypt, Telegram sender). The only layer that touches Prisma/external systems.
- `<name>.module.ts` wires providers; `<name>.tokens.ts` defines **explicit string DI tokens**. Services depend on port *tokens*, not concrete classes. `apps/api/src/app.module.spec.ts` is a regression test that compiles the real module graph and guards this token wiring — keep it green.

**Request flow:** global `ValidationPipe` (whitelist + forbidNonWhitelisted) → `AuthenticationGuard` (resolves the principal from the DB each request) → `TenantGuard` (enforces the JWT's tenant context) → `PermissionGuard` (checks route metadata from the `@Permissions` decorator). Routes opt out of auth with the public-route decorator. The API is URI-versioned under `/api/v1`.

**Two non-negotiable invariants:**
1. **Tenant isolation** — every repository call is scoped by `actor.rtId`. There is no ambient tenant; it comes from the authenticated principal. Cross-tenant reads/writes are bugs.
2. **Ledger integrity** — `cash_ledgers` rows are append-only (never physically deleted by app code). Posting a finance transaction writes the transaction status, ledger row, sequence, balance mirror, and audit log inside **one serializable DB transaction**, with retry on write conflicts. Audit rows for sensitive mutations are written in the same transaction as the change.

RBAC permission keys are the canonical vocabulary shared by REST routes, the Telegram bot, and the frontend nav — defined once in `apps/api/src/modules/rbac/domain/permission.constants.ts` (e.g. `collections.validate`, `transactions.post`, `approvals.decide`). Use existing keys; don't invent ad-hoc strings.

**Domain specifics worth knowing before editing:**
- Collection sessions have a **mode**: `PER_HOUSE` (per-house checklist), `BULK_TOTAL` (total-only, no house items), `HYBRID` (schema/API foundation only). Most flows branch on this — handle both `PER_HOUSE` and `BULK_TOTAL`.
- Finance posting independently re-checks expense-approval state, so it can't be bypassed. Validated jimpitan collections post to finance via a decoupled hook adapter (`JimpitanFinanceHooks`), not a direct call.
- Notifications, report exports, and Telegram delivery use an **outbox pattern**: the request writes an outbox row + audit in-transaction; the worker delivers it later.

## Worker

`apps/api/src/worker/main.ts` boots a NestJS *application context* (no HTTP server) and runs a polling loop. It drains the queues named in `WORKER_QUEUES` (`notification-outbox`, `report-exports`, `telegram-delivery`), recovers stale in-progress rows, writes a heartbeat file for container health, and shuts down on SIGTERM/SIGINT. It shares the API's modules/services rather than duplicating logic.

## Frontend architecture

Next.js App Router with three route groups under `apps/web/src/app`: `(public)` (unauthenticated transparency pages), `(auth)` (login), `(dashboard)` (private). Business logic lives under `src/features/<name>` (structure, jimpitan, finance, public-reports, auth, tenants); `src/lib` owns the API client, tenant-scoped query keys, and the permission-aware navigation registry; `src/components/ui` is shadcn-compatible primitives only.

**Auth/token model is the subtle part:** the browser never sees backend access/refresh tokens. The frontend hosts a same-origin BFF:
- `src/app/api/auth/*` — login/session/refresh/logout handlers store tokens in **httpOnly cookies** and return only session metadata. They reject cross-site POSTs via Origin / Sec-Fetch-Site checks.
- `src/app/api/backend/[...path]` — an **allowlisted** proxy that attaches the httpOnly bearer cookie server-side for tenant-scoped business APIs and rejects tenant-header mismatches.
- `src/proxy.ts` guards dashboard routes behind the session cookie and bounces authenticated users off login.
- Public transparency pages call the backend `/reports/public/...` endpoints **directly with credentials omitted**, and guard against private-shaped fields before rendering.

Server-only backend adapters are protected with the `server-only` package — keep token handling on the server side of that boundary.

Frontend data fetching is TanStack Query keyed by tenant; forms use React Hook Form + Zod.

## Conventions

- **File doc-headers:** every source file opens with a structured header — `Purpose / Caller / Deps / MainFuncs / SideEffects` (as a comment; `package.json` carries it as an `x-doc` field). This is pervasive and expected; preserve and update it when you change a file's role.
- **Keep maps current:** when you change a module's boundaries or add a feature area, update the relevant `.module_map.md` and `SYSTEM_MAP.md`. They are treated as part of the change, not afterthoughts.
- **No import cycles** — enforced by `npm run scan:imports`.
- **Tests are colocated** as `*.spec.ts` next to the code (both API and web use Vitest); E2E lives separately in `tests/e2e`.
- Indonesian-language copy and formatting are intentional in user-facing frontend strings and public reports.
