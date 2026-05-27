<!--
Purpose: Frontend public transparency UI implementation notes.
Caller: Product owner, frontend maintainers, and agents verifying public report behavior.
Deps: SYSTEM_MAP.md, apps/web/.module_map.md, docs/backend/reporting-api.md, apps/web/src/app/(public), apps/web/src/features/public-reports.
MainFuncs: Documents public routes, public-safe API integration, formatting, safety boundaries, states, and verification coverage.
SideEffects: None.
-->

# Public Transparency UI

## Implemented Scope
- `/`: public home with organization name, civic copy, cash balance, current-month income/expense, latest public report metadata, latest announcements, and CTA links.
- `/reports`: public finance summary with cash balance, income/expense totals, 6-month trend, category breakdown, collection CTA, report feed metadata, and public-safe CSV export link.
- `/reports/monthly?month=YYYY-MM`: shareable monthly public finance report with month filter, public totals, category table, shareable link, and CSV export link.
- `/reports/collections?month=YYYY-MM`: public collection summary derived only from public monthly income categories with CSV export link. Outstanding detail is intentionally not rendered because no public-safe outstanding summary endpoint exists.
- `/announcements`: searchable public announcement feed when the backend public announcement endpoint is available.

## API Integration
- Frontend uses `NEXT_PUBLIC_API_BASE_URL` and backend public report endpoints under `/reports/public/:rtCode/*`.
- Public pages do not call `/api/backend/*`, do not send cookies, do not send bearer tokens, and do not send `X-Tenant-Id`; fetch requests explicitly use `credentials: 'omit'`.
- Public CSV export links point directly to backend public export endpoints under `/reports/public/:rtCode/exports/*.csv` and do not use authenticated dashboard proxy routes.
- Public RT code resolves from safe `?rt=...`, then `NEXT_PUBLIC_PUBLIC_RT_CODE` or `NEXT_PUBLIC_RT_CODE`; if neither exists, the UI shows a safe configuration empty state instead of guessing a tenant.
- Public month and search filters are sanitized before backend calls; invalid months fall back to the current month.

## Safety
- Backend public serializers remain the source of truth.
- Frontend additionally rejects response keys matching private resident, phone, house, audit, approval, internal note, account detail, auth/session, Telegram, or ledger-row shapes before rendering.
- Public string values are redacted for phone-like strings at the API boundary and again at component render sites.
- Public collection UI shows only income categories that are explicitly collection-like by category key/name. It does not count unrelated income as collection total and does not render house, resident, phone, note, item, approval, audit, or ledger-row detail.
- Public export buttons use public-safe endpoints only; private ledger, transaction, approval, audit, internal note, house, resident, and phone data are never linked from public pages.

## UI States
- Public route group has a mobile-first loading skeleton and a non-sensitive error boundary.
- Empty category, feed, announcement, collection, and outstanding-safe states are explicit and avoid fake business data.
- Charts use accessible CSS bars paired with a readable table because Recharts is not present in the project foundation.

## Verification
- Web tests cover public API no-auth behavior, public CSV link construction, public API error state, serializer/private-field safety, public page render smoke, no phone rendering, mobile layout class anchors, report filtering, and empty states.
- Verification commands: `npm run test:web`, `npm run typecheck:web`, `npm run build:web`, frontend import-cycle scan, and `npm run build:api`.
