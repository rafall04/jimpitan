<!--
Purpose: Backend skeleton and implemented foundation structure note for the JIMPITAN NestJS API.
Caller: Architects, implementation agents, and maintainers reviewing generated backend boundaries.
Deps: apps/api/src, prisma/schema.prisma, docs/architecture/jimpitan-technical-architecture.md, docs/backend/notification-api.md, docs/backend/telegram-bot-api.md.
MainFuncs: Documents generated module structure, implemented foundations, notification and Telegram workflows, and remaining workflow boundaries.
SideEffects: None.
-->

# Backend Skeleton

## Structure

```text
apps/api/
  src/
    main.ts
    app.module.ts
    config/
    prisma/
    health/
    common/
      constants/
      decorators/
      filters/
      guards/
      interceptors/
      middleware/
      pipes/
      types/
      utils/
    modules/
      auth/
      rbac/
      users/
      tenants/
      residents/
      houses/
      jimpitan/
      finance/
      ledger/
      approvals/
      reports/
      notifications/
      telegram/
      audit/
      attachments/
```

## Boundaries

- `main.ts` wires API prefix, URI versioning, validation, exception handling, and Swagger.
- `app.module.ts` wires modules and request correlation middleware.
- `config` validates environment variables including bcrypt cost and JWT TTL/secret settings.
- `prisma` owns Prisma client lifecycle only.
- `health` exposes the only functional endpoint in this skeleton.
- Finance, ledger, expense approval, notification, and Telegram bot workflows are implemented; report, email provider delivery, audit browsing, and attachment modules still contain skeleton boundaries only.
- Auth foundation implements login, refresh token rotation, logout, current principal, bcrypt password/refresh-token hashing, tenant-scoped JWT access/refresh tokens, Prisma session repository, refresh replay detection, stored-hash logout validation, and correlated auth audit writes.
- RBAC foundation implements tenant-membership-gated permission checks, permission metadata decorators, Prisma permission-context repository, and guard provider wiring.
- Tenant foundation implements current tenant resolution and minimal RT CRUD with non-super-admin read/update scoping to the current RT plus super-admin-only tenant create/delete.
- User/Membership foundation implements safe profile reads, membership listing, tenant-scoped user list/create/update, membership create/disable, membership role replacement, tenant role permission replacement, pagination, and identity audit writes.
- Residents foundation implements tenant-scoped resident CRUD, search/filter/sort/pagination, archive/reactivate lifecycle, house moves, optional Telegram account binding, house occupancy synchronization, RBAC metadata, safe response selection, and audit writes.
- Houses/Areas foundation implements tenant-scoped area CRUD/archive, house CRUD/archive, area route ordering, house occupancy status validation, search/filter/sort/pagination, RBAC metadata, safe response selection, and audit writes.
- Jimpitan foundation implements tenant-scoped collection sessions, officer/route assignment, mobile checklist generation, collection item batch input, submit/validate/reject/cancel lifecycle, summaries, outstanding tracking, RBAC metadata, safe response selection, serializable route/date duplicate checks, conditional lifecycle updates, audit writes, and no-op finance/Telegram hook boundaries.
- Finance/Ledger foundations implement tenant-scoped cash accounts, categories, transaction drafts, validation/rejection/void/post lifecycle, dedicated source collection posting, append-only ledger rows, ledger-derived balances, RBAC metadata, DTO validation, repository ports, Prisma persistence, idempotent replay guards, approval posting gates, and audit logs.
- Expense approvals implement tenant-scoped approval policy, thresholds, request/decision lifecycle, cancellation, approver queues, self-approval prevention, notification hooks, finance posting integration, RBAC metadata, DTO validation, Prisma persistence, and audit logs.
- Notifications implement tenant-scoped in-app notification creation, recipient validation, outbox event writes, delivery lifecycle status, retry/cancel, unread counts, mark-read workflows, idempotency/dedupe replay, RBAC metadata, DTO validation, Prisma persistence, Telegram/email hook interfaces, and audit logs.
- Telegram implements webhook secret validation, update ingestion idempotency, account binding, tenant context selection, role-aware menu, command routing, session state, Jimpitan input, finance quick commands, approval actions, notification outbox Telegram delivery, RBAC metadata, DTO validation, Prisma persistence, and audit logs.
- Common guard files implement authentication, tenant, and permission enforcement but are provided by Auth/RBAC modules to avoid feature dependencies inside `CommonModule`.

## Explicitly Not Implemented

- Report, email provider delivery, audit browsing, attachment, public transparency, payment gateway, and analytics dashboard workflows.
- Password change workflow.
- Auth seed data or default roles/permissions.
- E2E auth smoke tests; no Nest e2e test harness is installed yet.
- Seed data.
- Frontend code.

## Implemented Auth/RBAC Endpoints

- `POST /api/v1/auth/login`: public login with optional `rtId`.
- `POST /api/v1/auth/refresh`: public refresh-token rotation.
- `POST /api/v1/auth/logout`: public refresh-session revocation.
- `GET /api/v1/auth/me`: bearer-auth current principal.

## Implemented Tenant/User Endpoints

- `GET /api/v1/tenants/current`: current RT resolver.
- `GET /api/v1/tenants`, `POST /api/v1/tenants`, `GET/PATCH/DELETE /api/v1/tenants/:rtId`: minimal RT tenant management.
- `GET /api/v1/users/me`: safe current user profile.
- `GET /api/v1/users/me/memberships`: current user membership list.
- `GET /api/v1/users`: tenant-scoped paginated user/membership list.
- `GET /api/v1/users/memberships`: tenant-scoped paginated membership list.
- `POST /api/v1/users`: create or attach a user to the current tenant.
- `PATCH /api/v1/users/:userId`: tenant-checked safe user update.
- `POST /api/v1/users/:userId/memberships`: create current-tenant membership for an existing user.
- `PUT /api/v1/users/memberships/:membershipId/roles`: replace current-tenant membership roles.
- `PATCH /api/v1/users/memberships/:membershipId/disable`: disable current-tenant membership.
- `PUT /api/v1/users/roles/:roleId/permissions`: replace permissions on a current-tenant role.

## Implemented Residents/Houses/Areas Endpoints

- `GET/POST /api/v1/areas`: list and create RT areas.
- `GET/PATCH /api/v1/areas/:areaId`: get and update an RT area.
- `PATCH /api/v1/areas/:areaId/archive`: archive an area after active-house checks.
- `GET/POST /api/v1/houses`: list and create RT houses.
- `GET/PATCH /api/v1/houses/:houseId`: get and update an RT house.
- `PATCH /api/v1/houses/:houseId/archive`: archive a house after active-resident checks.
- `GET/POST /api/v1/residents`: list and create RT residents.
- `GET/PATCH /api/v1/residents/:residentId`: get and update a resident.
- `PATCH /api/v1/residents/:residentId/house`: move a resident to another house.
- `PATCH /api/v1/residents/:residentId/archive`: archive a resident and update house occupancy when needed.
- `PATCH /api/v1/residents/:residentId/reactivate`: reactivate a resident and update house occupancy when needed.

## Implemented Jimpitan Collection Endpoints

- `GET/POST /api/v1/jimpitan/collections`: list and create collection sessions.
- `GET /api/v1/jimpitan/collections/mobile/my`: list current officer collection sessions for mobile clients.
- `GET/PATCH /api/v1/jimpitan/collections/:collectionId`: get and update a collection session.
- `PATCH /api/v1/jimpitan/collections/:collectionId/start`: move an editable session to `IN_PROGRESS`.
- `PATCH /api/v1/jimpitan/collections/:collectionId/cancel`: cancel a non-validated session.
- `GET /api/v1/jimpitan/collections/:collectionId/checklist`: get mobile-friendly house checklist.
- `POST /api/v1/jimpitan/collections/:collectionId/checklist/generate`: generate checklist and mark editable sessions in progress.
- `PUT /api/v1/jimpitan/collections/:collectionId/items/batch`: upsert collection item batches by house.
- `PATCH /api/v1/jimpitan/collections/:collectionId/submit`: submit collection for treasurer validation.
- `PATCH /api/v1/jimpitan/collections/:collectionId/validate`: validate submitted collection without finance ledger posting.
- `PATCH /api/v1/jimpitan/collections/:collectionId/reject`: reject submitted collection.
- `GET /api/v1/jimpitan/collections/:collectionId/summary`: get totals, completion, outstanding count, and per-area progress.
- `GET /api/v1/jimpitan/collections/:collectionId/outstanding`: get paginated outstanding houses.

## Implemented Finance/Ledger Endpoints

- `GET/POST /api/v1/finance/cash-accounts`: list and create cash accounts.
- `GET /api/v1/finance/cash-accounts/default`: default cash account lookup.
- `GET/PATCH /api/v1/finance/cash-accounts/:cashAccountId`: cash account detail and update.
- `GET /api/v1/finance/cash-accounts/:cashAccountId/balance`: ledger-derived cash account balance.
- `PATCH /api/v1/finance/cash-accounts/:cashAccountId/archive`: cash account archive/inactivate.
- `GET/POST /api/v1/finance/categories`: list and create income/expense categories.
- `GET/PATCH /api/v1/finance/categories/:categoryId`: category detail and update.
- `PATCH /api/v1/finance/categories/:categoryId/archive`: category archive.
- `GET /api/v1/finance/transactions`: list transactions.
- `POST /api/v1/finance/transactions/income`: create income draft.
- `POST /api/v1/finance/transactions/expense`: create expense draft.
- `POST /api/v1/finance/transactions/source-collections`: post validated Jimpitan collection.
- `GET /api/v1/finance/transactions/:transactionId`: transaction detail.
- `PATCH /api/v1/finance/transactions/:transactionId/validate`: validate transaction.
- `PATCH /api/v1/finance/transactions/:transactionId/reject`: reject transaction.
- `PATCH /api/v1/finance/transactions/:transactionId/void`: void draft transaction.
- `PATCH /api/v1/finance/transactions/:transactionId/post`: post validated transaction to ledger.
- `GET /api/v1/ledger`: list ledger entries.
- `GET /api/v1/ledger/:ledgerEntryId`: ledger entry detail.
- `GET /api/v1/ledger/cash-accounts/:cashAccountId/balance`: ledger-derived balance.

## Implemented Telegram Bot Endpoints

- `POST /api/v1/telegram/webhook`: public Telegram webhook with secret validation and idempotent update ingestion.
- `POST /api/v1/telegram/bind-codes`: create a one-time bind code for an active same-tenant target.
- `POST /api/v1/telegram/outbox/drain`: drain pending Telegram notification outbox events.

## Security Review Notes

- Refresh-token reuse or failed atomic rotation revokes the session and writes a replay/failure audit event.
- Logout no longer revokes a session unless the supplied refresh token matches the stored hash.
- Access and refresh JWTs are verified with HS256 and runtime-validated required claims.
- Multi-RT users must supply `rtId` at login to avoid accidental tenant selection.
- Auth audit IP capture uses `request.ip`; direct trust of `x-forwarded-for` is intentionally avoided until proxy trust is configured.
- Identity mutation audits cover user created, user updated, membership created, membership role changed, and membership disabled.
- Tenant mutation audits cover tenant created, tenant updated, and tenant deleted; tenant responses use a safe select that excludes internal audit fields.
- Membership and role permission assignment blocks privilege escalation by requiring assigned permissions to be within the actor permission set unless the actor is `SUPER_ADMIN`.
- Membership role assignment also blocks `SUPER_ADMIN` role grants by non-super-admin actors.
- User status changes require `users.deactivate` permission or `SUPER_ADMIN`, even when the route caller has `users.update`.
- Resident, house, and area repository methods always receive the current `rtId`; cross-RT assignments return not-found style errors.
- Area archive is blocked while active houses still reference the area, and house archive is blocked while active residents still reference the house.
- Resident house assignment rejects archived or inactive houses and synchronizes house occupancy status inside the same transaction as resident lifecycle changes.
- Resident house moves require an active resident, and reactivation rejects residents that are already active.
- House `OCCUPIED` status is derived from active resident assignments; creating occupied houses or marking vacant houses occupied is rejected.
- Optional resident Telegram binding rejects missing, revoked, or already-bound Telegram accounts before persistence and rechecks binding state inside the write transaction.
- Jimpitan collection create/update uses same-tenant officer/area validation and serializable transaction rechecks to reduce route/date duplicate races.
- Jimpitan item input rejects archived/inactive houses, archived areas, archived/inactive residents, duplicate house entries, and amount/status mismatches.
- Jimpitan lifecycle transitions use conditional transactional updates so stale submitted/validated/rejected writes fail instead of overwriting newer state.
- Collection validation dispatches hook events; finance collection posting and Telegram notification delivery run through decoupled service boundaries.
