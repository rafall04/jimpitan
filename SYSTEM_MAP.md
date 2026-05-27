<!--
Purpose: Root-level navigation map for the JIMPITAN planning workspace, app foundation, and infrastructure foundation.
Caller: Codex agents and maintainers before making project changes.
Deps: .module_map.md, infrastructure/.module_map.md, tests/.module_map.md, docs/deployment/README.md, docs/deployment/runtime-smoke.md, docs/testing/README.md, docs/testing/e2e.md, docs/production-readiness.md, docs/production-readiness/README.md, docs/security/audit.md, docs/visual-planning/index.html, docs/architecture/jimpitan-technical-architecture.md, prisma/schema.prisma, docs/database/prisma-schema-notes.md, apps/api/.module_map.md, apps/web/.module_map.md, docs/backend/backend-skeleton.md, docs/backend/notification-api.md, docs/backend/telegram-bot-api.md, docs/backend/reporting-api.md, docs/frontend/web-architecture.md, docs/frontend/jimpitan-operational-ui.md, docs/frontend/finance-approval-ui.md, docs/frontend/public-transparency-ui.md.
MainFuncs: Documents current workspace state, planning artifacts, collection mode support, implemented app foundations, infrastructure foundations, testing foundations, and required read order.
SideEffects: None.
-->

# SYSTEM_MAP

## Workspace State
- `C:\project\rt` now contains planning artifacts, Prisma schema, a NestJS backend skeleton, Auth/RBAC foundation, Tenant/User/Membership foundation, Residents/Houses/Areas modules, Jimpitan collection workflow, Finance/Ledger, Expense Approval, Notification, Telegram Bot, Reporting/Public Transparency/Export Engine foundation modules, a database-backed worker foundation, a Next.js frontend application shell, frontend Residents/Houses/Areas UI, frontend Jimpitan operational UI, frontend Finance/Ledger/Approval/Report Export UI, public transparency site/report pages, and VPS-friendly Docker/Nginx/PostgreSQL/Redis infrastructure foundations.
- Frontend foundation is implemented with Auth/Session, Residents/Houses/Areas business pages, Jimpitan collection operations, finance/approval workflows, private report export controls, and unauthenticated public transparency pages; settings pages remain placeholders.
- Email provider delivery integration, attachment workflows, payment gateway, and analytics dashboards remain excluded. Finance, cash ledger, expense approval, notification workflow, Telegram bot command handling, Telegram notification delivery logic, reporting engine, public transparency endpoints, and export engine foundation are implemented.

## Required Local Maps
- `.module_map.md`: planning artifact map and ownership boundaries.
- `infrastructure/.module_map.md`: Docker Compose, Nginx, storage, and operations script map.
- `apps/api/src/worker/.module_map.md`: background worker process map.
- `tests/.module_map.md`: E2E, smoke, fixture, and readiness test foundation map.

## Planning Artifacts
- `docs/visual-planning/index.html`: static visual planning companion for JIMPITAN IA, flows, layouts, design system, and mobile workflows.
- `docs/architecture/jimpitan-technical-architecture.md`: production architecture, schema blueprint, RBAC, API plan, operations, and implementation phases.
- `prisma/schema.prisma`: database-only Prisma schema for JIMPITAN.
- `docs/database/prisma-schema-notes.md`: schema explanation, constraints, indexes, ledger rules, and migration notes.
- `docs/backend/backend-skeleton.md`: generated NestJS backend skeleton structure and boundaries.
- `docs/backend/jimpitan-collection-api.md`: Jimpitan collection REST/OpenAPI contract notes.
- `docs/backend/finance-ledger-api.md`: Finance and cash ledger REST/OpenAPI contract notes.
- `docs/backend/expense-approval-api.md`: Expense approval REST/OpenAPI and workflow contract notes.
- `docs/backend/notification-api.md`: Notification REST/OpenAPI and outbox contract notes.
- `docs/backend/telegram-bot-api.md`: Telegram webhook, binding, command, session, and outbox delivery contract notes.
- `docs/backend/reporting-api.md`: Reporting engine, public transparency, and export foundation REST/OpenAPI contract notes.
- `docs/frontend/web-architecture.md`: Next.js frontend shell architecture, route groups, provider boundaries, component hierarchy, and verification notes.
- `docs/frontend/jimpitan-operational-ui.md`: frontend Jimpitan route, mobile workflow, cache, tenant, and RBAC notes.
- `docs/frontend/finance-approval-ui.md`: frontend finance, ledger, posting, approval, cache, and safety UX notes.
- `docs/frontend/public-transparency-ui.md`: frontend public transparency pages, public-safe API usage, empty/error/loading states, and safety notes.
- `docs/deployment/README.md`: VPS-friendly Compose deployment, env, migration, health, worker, security, storage, and backup/restore runbook.
- `docs/testing/README.md`: E2E, smoke, deterministic fixture, cleanup, and manual Docker validation runbook.
- `docs/testing/e2e.md`: Playwright E2E runtime, seed, cleanup, and artifact runbook.
- `docs/deployment/runtime-smoke.md`: runtime smoke-check and Docker validation fallback runbook.
- `docs/security/audit.md`: production npm audit advisory triage, mitigation status, safe upgrade guidance, and temporary risk acceptance notes.
- `docs/production-readiness.md`: launch-facing production readiness summary and dependency security launch checklist.
- `docs/production-readiness/README.md`: production security and operations readiness checklist.

## Backend Foundation
- `apps/api/.module_map.md`: local backend map.
- `apps/api/src/modules/residents/.module_map.md`: resident module map.
- `apps/api/src/modules/houses/.module_map.md`: houses and areas module map.
- `apps/api/src/main.ts`: NestJS bootstrap with validation, versioning, exception filter, and Swagger.
- `apps/api/src/worker`: NestJS application-context background worker for report exports and notification/Telegram outbox delivery.
- `apps/api/src/runtime/logging.ts`: shared API/worker logging level resolver.
- `apps/api/src/app.module.ts`: backend module wiring.
- `apps/api/src/config`: environment configuration validation.
- `apps/api/src/prisma`: Prisma module and client lifecycle boundary.
- `apps/api/src/common`: shared decorators, guards, middleware, interceptors, filters, pipes, constants, types, and utilities.
- `apps/api/src/modules/auth`: login, refresh rotation, logout, current principal, bcrypt hashing, JWT, Prisma session repository, and auth audit writes.
- `apps/api/src/modules/rbac`: tenant-aware permission evaluation, Prisma permission-context repository, and permission guard provider.
- `apps/api/src/modules/tenants`: current tenant resolver plus minimal RT CRUD with tenant access enforcement.
- `apps/api/src/modules/users`: safe profile, membership listing, tenant-scoped user management, membership role assignment, permission assignment, and identity audit logs.
- `apps/api/src/modules/residents`: tenant-scoped resident CRUD, active/archive/reactivate lifecycle, house moves, optional Telegram account binding, RBAC, and audit logs.
- `apps/api/src/modules/houses`: tenant-scoped house and area CRUD/archive, occupancy status enforcement, route ordering metadata, RBAC, and audit logs.
- `apps/api/src/modules/jimpitan`: tenant-scoped collection sessions, `PER_HOUSE` and `BULK_TOTAL` collection mode enforcement, officer/route assignment, checklist or total input, submit/validate/reject/cancel lifecycle, summaries, outstanding tracking, audit logs, RBAC, and finance/Telegram hook boundaries.
- `apps/api/src/modules/finance`: tenant-scoped cash accounts, categories, transaction lifecycle, atomic ledger posting, idempotency, mode-aware collection posting hook adapter, audit logs, RBAC route metadata, DTOs, and Prisma repository.
- `apps/api/src/modules/ledger`: append-only cash ledger reads, ledger-derived balances, RBAC route metadata, DTOs, and Prisma repository.
- `apps/api/src/modules/approvals`: tenant-scoped expense approval policy, threshold evaluation, request/decision lifecycle, approval queues, notification hooks, audit logs, RBAC route metadata, DTOs, and Prisma repository.
- `apps/api/src/modules/notifications`: tenant-scoped in-app notifications, outbox rows, delivery lifecycle, retry, idempotency, recipient validation, audit logs, RBAC route metadata, DTOs, and Telegram/email delivery hook interfaces.
- `apps/api/src/modules/telegram`: Telegram webhook, update ingestion, binding, role-aware menu, command routing, state machine, `PER_HOUSE` and `BULK_TOTAL` Jimpitan input, finance commands, approval actions, Telegram outbox delivery, audit logs, tenant isolation, and RBAC.
- `apps/api/src/modules`: email provider delivery integration, audit browsing, and attachment workflows remain skeleton-only.

## Frontend Foundation
- `apps/web/.module_map.md`: local frontend shell map.
- `apps/web/src/app`: Next.js App Router public, auth, dashboard, health, same-origin auth API, and allowlisted backend proxy route groups with implemented public transparency, structure, Jimpitan, finance, ledger, approval, and report export pages plus remaining private placeholders.
- `apps/web/src/proxy.ts`: Next.js proxy guard for dashboard session routing and login redirect behavior.
- `apps/web/src/components`: shadcn-compatible primitives, app shell, feedback, form, and table foundations.
- `apps/web/src/features/auth`: safe login form, same-origin auth client, same-origin POST validation, backend Auth adapter, httpOnly cookie helpers, session mapper/loader, refresh/logout hooks, permission UI helper, and server cookie reader.
- `apps/web/src/features/tenants`: tenant context provider for RT switching and permission scope.
- `apps/web/src/features/structure`: Residents/Houses/Areas API adapter, TanStack hooks, forms, status display, detail sheets, RBAC-aware actions, mobile list cards, and tests.
- `apps/web/src/features/jimpitan`: Jimpitan collection API adapter, mode contracts, TanStack hooks, lifecycle helpers, session list/detail pages, per-house and bulk-total mobile collection flow, validation controls, outstanding tracking, and tests.
- `apps/web/src/features/finance`: Finance/Ledger/Approval/Report Export API adapter, TanStack hooks, lifecycle helpers, forms, transaction/account/category pages, ledger view, mode-aware collection posting, approval queue/detail pages, private export panel, and tests.
- `apps/web/src/features/public-reports`: unauthenticated public report API adapter, public CSV export links, safe format helpers, public page components, private-field guard, Indonesian copy/formatting, and tests.
- `apps/web/src/lib`: API client, environment validation, permission helpers, navigation registry, query keys, query provider, and utilities.
- `apps/web/Dockerfile`: frontend standalone Docker build path.
- `vitest.config.mts`: frontend path alias support for web tests.

## Infrastructure Foundation
- `compose.prod.yaml`: production Compose topology for `api`, `web`, `worker`, `postgres`, `redis`, and `nginx`, with only Nginx exposed to the host.
- `compose.staging.yaml`: existing-VPS host-Nginx override that disables container Nginx by profile, exposes web on `127.0.0.1:3100`, exposes API on `127.0.0.1:3101`, and keeps PostgreSQL/Redis private.
- `compose.dev.yaml`: local container topology with explicit developer ports.
- `apps/api/Dockerfile`: production API image.
- `apps/api/Dockerfile.worker`: production worker image.
- `apps/web/Dockerfile`: production web image.
- `infrastructure/nginx/nginx.conf`: reverse proxy, security headers, request size limit, health route, and rate-limit foundation.
- `env.example`, `apps/api/env.example`, and `apps/web/env.example`: safe placeholder env examples with no committed secrets and optional blank S3 settings for local-volume storage.
- `.gitattributes`: Git line-ending normalization for source, config, shell scripts, Dockerfiles, and deployment files.
- `scripts/backup-postgres.sh` and `scripts/restore-postgres.sh`: PostgreSQL backup/restore script foundation.
- `scripts/check-production-infra.mjs`: static production infrastructure safety checks used by `npm run infra:check`.
- `scripts/check-import-cycles.mjs`: dependency-cycle scan used by `npm run scan:imports`.
- `scripts/run-prisma-schema-command.mjs`: schema-only Prisma generate/validate wrapper with a non-secret placeholder database URL.

## Testing And Readiness Foundation
- `tests/.module_map.md`: local testing ownership map.
- `tests/e2e`: Playwright critical journey contracts, env, fixture, cleanup, and API helper stubs.
- `tests/smoke`: API, web, public report, RBAC/tenant isolation, and optional Telegram webhook smoke skeletons.
- `scripts/e2e-check.mjs`: `npm run test:e2e` environment gate and Playwright launcher when E2E env is configured.
- `scripts/smoke-check.mjs`: `npm run test:smoke` runtime HTTP smoke gate when smoke URLs are configured.
- `scripts/readiness-check.mjs`: `npm run readiness:check` production readiness/security static gate.
- `scripts/deployment-verify.mjs`: deployment verification command for static gates and optional full build/test checks.
- `playwright.config.ts`: API/web E2E startup, browser artifact, and global setup/teardown configuration.
- `.github/workflows/ci.yml`: GitHub Actions CI for build, test, infra, readiness, Docker config, and E2E checks.

## Ignored Heavy Directories
- `node_modules`, `venv`, `.venv`, `env`, `vendor`, `target`, `.gradle`, `bin`, `obj`, `pkg`, `.git`, `.vscode`, `.idea`, `pycache`, `dist`, `build`, `tmp`, `coverage`, `.next`, `.nuxt`, `.cache`.
