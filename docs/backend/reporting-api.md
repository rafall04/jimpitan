<!--
Purpose: Reporting engine and public transparency API notes for the JIMPITAN backend.
Caller: Product owner, backend maintainers, and implementation agents verifying report behavior.
Deps: SYSTEM_MAP.md, apps/api/.module_map.md, apps/api/src/modules/reports, prisma/schema.prisma.
MainFuncs: Documents report endpoints, mode-aware collection rules, ledger-source rules, public serializers, export and worker foundations, RBAC, and testing coverage.
SideEffects: None.
-->

# Reporting Engine + Public Transparency API

## Implemented Scope
- Private report endpoints under `/api/v1/reports` use Auth, Tenant, and Permission guards.
- Public transparency endpoints under `/api/v1/reports/public/:rtCode/*` are unauthenticated but resolve only active, non-deleted RT codes and use strict public-safe serializers.
- Finance reports derive from immutable `cash_ledgers` joined to `POSTED` transactions. Rejected, voided, draft, deleted, and non-posted transactions are excluded.
- Export requests create tenant-scoped `report_exports` rows with idempotency, `PENDING`/`PROCESSING`/`COMPLETED`/`FAILED`/`EXPIRED` API statuses, CSV foundation processing, worker queued CSV processing, retry, expiration metadata, and download audit logs. PDF and Excel are provider interfaces only.

## Private Endpoints
- `GET /reports/finance/summary`: daily, weekly, monthly, yearly, or custom ledger-derived finance summary.
- `GET /reports/finance/cash-flow`: opening balance, income, expense, net flow, and closing balance.
- `GET /reports/finance/expense-categories`: ledger-derived expense category breakdown.
- `GET /reports/collections/performance`: mode-aware collection completion and paid/unpaid performance; `BULK_TOTAL` contributes collection totals without item counts.
- `GET /reports/collections/per-area-progress`: active-house progress by area plus area-scoped `BULK_TOTAL` totals when present.
- `GET /reports/outstanding/houses`: paginated outstanding house rows, excluding internal notes and total-only sessions.
- `GET /reports/approvals/activity`: approval status activity summary.
- `GET /reports/audit/activity`: private audit activity counts by action and entity type.
- `POST /reports/exports`: create export requests for finance summary, monthly report, collection summary, private ledger, private transaction, and public-safe transparency CSV/PDF/Excel foundations.
- `GET /reports/exports` and `GET /reports/exports/:exportId`: tenant-scoped export status reads with `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, and `EXPIRED`.
- `GET /reports/exports/:exportId/download`: tenant-scoped CSV download for completed exports only.
- `POST /reports/exports/:exportId/retry`: retry failed exports while preserving tenant isolation and audit trail.

## Public Endpoints
- `GET /reports/public/:rtCode/summary`: public-safe cash balance total and current-month income/expense totals.
- `GET /reports/public/:rtCode/monthly-finance?month=YYYY-MM`: public-safe monthly totals and category totals.
- `GET /reports/public/:rtCode/metadata`: public announcement/report metadata feed.
- `GET /reports/public/:rtCode/announcements`: public announcement feed.
- `GET /reports/public/:rtCode/exports/summary.csv`: public-safe transparency summary CSV.
- `GET /reports/public/:rtCode/exports/monthly-finance.csv?month=YYYY-MM`: public-safe monthly finance CSV.
- `GET /reports/public/:rtCode/exports/collections.csv?month=YYYY-MM`: public-safe collection summary CSV derived from collection-like income categories only.

## Safety Rules
- Public responses never include resident names, phone numbers, internal collection notes, audit log rows, approval internals, ledger rows, or transaction descriptions.
- Date ranges are validated and capped to 366 days.
- Date and month values use strict calendar validation; normalized dates such as February 30 are rejected.
- Finance summary cash balances are calculated at the report date cutoff, not from later ledger rows.
- Collection performance defaults to submitted and validated collections only; rejected, draft, in-progress, and cancelled amounts are excluded by default.
- `PER_HOUSE` amounts come from paid items; `BULK_TOTAL` amounts must use collection `totalAmount` and must not inflate house completion or outstanding counts.
- Outstanding house reports exclude inactive/deleted houses and inactive/deleted areas.
- Export idempotency replays only when report type, format, and filters match the original request.
- Worker export processing claims queued CSV exports by `(status, format, createdAt)` in small batches and writes audit logs under the requesting user context.
- Export filters reject unsafe prototype-pollution keys and oversized JSON payloads.
- CSV export serialization neutralizes spreadsheet formula-like string cells.
- Public-safe exports exclude cash account IDs, ledger sequences, resident/house data, phone numbers, audit rows, approval internals, internal notes, and transaction descriptions.
- Ledger and transaction exports are private-only and require authenticated `reports.export` access.
- Completed exports store file metadata in `report_exports.fileName`, `objectKey`, `completedAt`, and `expiresAt`; schema-backed attachment storage remains unused until the attachment module is implemented.
- DB-heavy report reads use tenant/date filters aligned with existing indexes such as `(rtId, ledgerDate)` and select only required fields.

## Verification Coverage
- Unit tests cover strict date/month validation, tenant delegation, public-safe serialization, ledger-based finance aggregation, collection status exclusion, bulk-total collection aggregation, archived outstanding filters, grouped activity aggregation, export filter hardening, export idempotency replay, CSV correctness, private/public export separation, download authorization, failed export retry, outstanding note stripping, and CSV/formula escaping.
