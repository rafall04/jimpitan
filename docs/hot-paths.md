<!--
Purpose: Jump table from "task/concern" to the exact file + symbol for JIMPITAN's hot paths, so an agent can open one location instead of exploring.
Caller: Claude Code / Codex agents and maintainers locating where a behavior lives before editing.
Deps: Mirrors code in apps/api/src and apps/web/src; complements SYSTEM_MAP.md (module inventory) and each module's .module_map.md (boundaries).
MainFuncs: Indexes finance/ledger posting, auth/session, the request guard pipeline, jimpitan collection modes, env/config, the BFF token model, the worker/outbox, cross-cutting edges, and DB hot spots.
SideEffects: None. Documentation only.
-->

# Hot Paths — Jump Table

**How to use this:** find the concern, open that one file at that symbol. **Navigate by the symbol name** — it is stable; the line numbers are only hints and drift as code changes. If a line is off, `Grep` the symbol rather than reading the whole file. This is the precise alternative to broad exploration (see CLAUDE.md → *Working efficiently*).

Scope: the most-touched / highest-risk paths only. For module boundaries see `SYSTEM_MAP.md` + each `*/.module_map.md`; for "what is this file", read its `Purpose/Caller/Deps` doc-header.

---

## Finance & ledger (invariant #2 — handle with care)

File: `apps/api/src/modules/finance/infrastructure/prisma-finance.repository.ts`

| Concern | Symbol (line) |
|---|---|
| Post a transaction atomically (status + ledger + sequence + balance mirror + audit) | `postTransaction` (562) |
| Serializable + P2034 retry envelope (wraps every posting) | `withSerializableRetry` (1524) |
| Post a validated jimpitan collection to finance | `postValidatedCollection` (640) |
| The actual ledger append (sequence, balanceBefore/After, mirror, audit) | `appendLedgerForTransaction` (1081) |
| Expense-approval gate re-checked in-transaction (cannot be bypassed) | `assertExpenseApprovalGateInTransaction` (900) |
| Lost-update guard on every `updateMany` | `assertSingleMutation` (1131) |
| Positive-amount check (service layer, defense-in-depth) | `finance-transactions.service.ts` → `assertPositiveAmount` (~153) |

> `cash_ledgers` is append-only — enforced in app code (no `cashLedger.update/delete`) **and** at the DB level by a trigger + balance/amount CHECK constraints (migration `20260622120000_ledger_integrity_guards`).

## Auth & session

| Concern | Location |
|---|---|
| Login / refresh-rotation / replay-detection / logout | `modules/auth/application/auth.service.ts` (login ~30, refresh+replay ~58, logout ~109) |
| `changePassword` is a stub that throws "not implemented" | `auth.service.ts` (~113) |
| Refresh-token CAS rotation (single-winner) + audit write | `modules/auth/infrastructure/prisma-auth.repository.ts` (rotation ~113, `writeAudit` ~172) |
| JWT sign/verify pinned to HS256, TTLs (access 15m / refresh 30d) | `modules/auth/infrastructure/jwt-auth-token.service.ts` (~26/40/53, TTL ~62/70) |
| bcrypt cost factor (12) | `modules/auth/infrastructure/bcrypt-password-hasher.service.ts` (~18) |

## Request pipeline — guards & RBAC

| Concern | Location |
|---|---|
| Resolve principal from DB each request | `common/guards/authentication.guard.ts` → `canActivate` (21) |
| Reject `X-Tenant-Id` ≠ token tenant (tenant isolation edge) | `common/guards/tenant.guard.ts` → `canActivate` (22) |
| Check `@RequirePermissions` route metadata | `common/guards/permission.guard.ts` → `canActivate` (22) |
| RBAC allow/deny logic, SUPER_ADMIN bypass | `modules/rbac/application/rbac.service.ts` (deny ~15, super-admin ~19) |
| Canonical permission keys (shared REST/Telegram/web) | `modules/rbac/domain/permission.constants.ts` |

> Guards run **globally** via `APP_GUARD` in `app.module.ts` (order Auth→Tenant→Permission), so auth is fail-closed by default. Opt out with `@PublicRoute()` (skip all three) or `@SkipTenantGuard()` (cross-tenant admin, e.g. `TenantsController`).

## Jimpitan collections

| Concern | Location |
|---|---|
| Collection lifecycle + PER_HOUSE / BULK_TOTAL branching | `modules/jimpitan/application/jimpitan.service.ts` |
| HYBRID mode intentionally rejected (reserved) | `jimpitan.service.ts` (~282) |
| Decoupled finance/telegram hook dispatch (`collectionValidated` → finance) | `modules/jimpitan/infrastructure/jimpitan-finance.hooks.ts` (~31, synthetic actor ~32) |

## Config / environment

| Concern | Location |
|---|---|
| Production env validation (reject placeholders, HTTPS-CORS, secret strength) | `apps/api/src/config/env.validation.ts` (prod `superRefine` ~49, JWT min-32 ~74, bcrypt clamp ~25) |
| API bootstrap: ValidationPipe (whitelist), versioning, Swagger | `apps/api/src/main.ts` (~42) |
| Stable error envelope; non-HTTP 500s return a generic message + log internally (no leak) | `common/filters/global-exception.filter.ts` |
| DI graph regression test (keep green) | `apps/api/src/app.module.spec.ts` |

## Frontend BFF / token security

| Concern | Location |
|---|---|
| Allowlisted backend proxy (`ALLOWED_RESOURCES`), attaches bearer server-side, tenant-match check | `apps/web/src/app/api/backend/[...path]/route.ts` (allowlist 20, state-changing 21, CSRF 50, allow-check 55, `isAllowedPath` 137) |
| Same-origin / CSRF check — default-deny when Origin + Sec-Fetch-Site are both absent | `apps/web/src/features/auth/csrf.server.ts` → `isSameOriginRequest` |
| httpOnly cookie writer (access/refresh/meta) | `apps/web/src/features/auth/session-cookies.server.ts` → `setSessionCookies` (~22) |
| Login — credentials POSTed to the same-origin BFF; backend login + tokens handled server-side (never in browser JS) | `auth-client.ts` `loginWithPassword` → `app/api/auth/session/route.ts` POST |
| Auth route handlers (same-origin gated) | `app/api/auth/{session(58),refresh(18),logout(16)}/route.ts` |
| Dashboard guard / login bounce | `apps/web/src/proxy.ts` (~15) |
| Public report fetch (`credentials:'omit'`) + recursive private-field guard | `apps/web/src/features/public-reports/api.ts` (omit ~107, `inspectPublicPayload` ~79) |

## Worker / outbox

| Concern | Location |
|---|---|
| Poll loop, graceful stop, heartbeat | `apps/api/src/worker/worker.service.ts` (loop ~42, `writeHealth` ~96); SIGTERM in `worker/main.ts` (~20) |
| Claim CSV exports (conditional updateMany) + stale recovery | `modules/reports/infrastructure/prisma-reports.repository.ts` (`claimPendingCsvExports` ~486, recover ~471) |
| Claim Telegram outbox + **fixed 5-min retry, no max-attempt cap (known risk)** | `modules/telegram/infrastructure/prisma-telegram.repository.ts` (`claimPendingTelegramOutbox` ~339, retry ~502) |

## Database hot spots

File: `prisma/schema.prisma`

| Concern | Location |
|---|---|
| `CashLedger` — sequence unique, FK Restrict, append-only trigger + balance/amount CHECKs (migration 20260622120000) | `model CashLedger` (~732) |
| Prisma engine targets (Bookworm/OpenSSL-3 — enforced by `infra:check`) | `binaryTargets` (~7) |
| Migrations: `20260530093000_initial` + `20260622120000_ledger_integrity_guards` (append-only trigger, positive-amount & balance CHECKs) | `prisma/migrations/` |
