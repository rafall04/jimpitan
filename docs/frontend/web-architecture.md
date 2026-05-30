<!--
Purpose: Frontend web architecture notes for the JIMPITAN application shell and public transparency UI.
Caller: Codex agents, frontend maintainers, and implementation planners.
Deps: SYSTEM_MAP.md, apps/web/.module_map.md, docs/architecture/jimpitan-technical-architecture.md, docs/frontend/jimpitan-operational-ui.md, docs/frontend/finance-approval-ui.md, docs/frontend/public-transparency-ui.md, apps/web/src.
MainFuncs: Documents App Router structure, provider boundaries, public transparency, auth/tenant handling, API/query/form/table foundations, operations modules, and verification expectations.
SideEffects: None.
-->

# Frontend Web Architecture

## Scope
- Implemented shell, public transparency UI, Auth/Session UI, Residents/Houses/Areas management, Jimpitan operational workflows, and Finance/Ledger/Approval workflows: Next.js App Router, TypeScript, Tailwind CSS v4, shadcn-compatible primitives, TanStack Query, React Hook Form, Zod, public/private route separation, configured backend login, same-origin auth session route handlers, same-origin backend proxy, same-origin POST validation, httpOnly cookie session strategy, refresh/logout flow, and Docker readiness.
- Excluded: PDF/Excel generation UI, payment gateway UI, masjid-specific modules, AI analytics, Telegram UI, fake business data, and private reports dashboard visuals.

## Route Architecture
- `apps/web/src/app/(public)`: public home, reports summary, monthly reports, collection summary, announcements, loading skeleton, and public-safe error boundary. Public serializers remain backend-owned; frontend rejects private-shaped payload fields before rendering.
- `apps/web/src/app/(auth)`: login shell. The form posts to the configured backend login endpoint and then asks the same-origin session route to persist secure cookies; it does not persist tokens in browser storage.
- `apps/web/src/app/(dashboard)`: private dashboard shell with implemented Residents, Houses, Areas, Jimpitan, Finance/Ledger, and Approval routes; reports and settings remain placeholders.
- `apps/web/src/app/api/auth`: same-origin session, refresh, and logout route handlers that persist backend login results and call backend Auth/RBAC APIs server-side when needed.
- `apps/web/src/app/api/backend/[...path]`: allowlisted same-origin proxy for Residents/Houses/Areas/Jimpitan/Finance/Ledger/Approval/Reports APIs and membership lookup. It requires an active tenant header matching session metadata and attaches bearer tokens server-side.
- `apps/web/src/proxy.ts`: Next.js 16 proxy guard for dashboard routes and authenticated-login redirects.

## Provider Boundaries
- Root server layout owns HTML metadata, language, skip link, and global CSS.
- `AppProviders` is the only root client provider boundary and wires theme, TanStack Query, and toast rendering.
- Dashboard server layout reads non-sensitive session metadata from httpOnly cookies and redirects before protected route content renders.
- `DashboardShell` validates the active session through TanStack Query before rendering protected children.
- `TenantProvider` is client-only and owns active RT selection plus permission set for navigation filtering.

## API And Query Strategy
- `src/lib/env/env.ts` validates `NEXT_PUBLIC_API_BASE_URL`; no API URL is hardcoded in source.
- `src/lib/api/client.ts` centralizes `fetch`, credentials, `X-Tenant-Id`, and `Idempotency-Key` headers for future feature APIs.
- `src/lib/api/url.ts` joins API URLs while preserving configured base paths and rejecting absolute path overrides.
- `src/features/auth/backend-auth.server.ts` is the server-only Auth API adapter used by Next auth route handlers.
- `src/features/auth/auth-client.ts` calls the configured backend login endpoint with `NEXT_PUBLIC_API_BASE_URL`, then uses the same-origin session route to persist cookie-backed session state without browser token storage.
- `src/features/structure/api.ts` calls same-origin `/api/backend/*` routes for Residents/Houses/Areas so browser code never handles bearer tokens for business APIs.
- `src/features/jimpitan/api.ts` calls same-origin `/api/backend/jimpitan/collections*` for session, checklist, summary, outstanding, lifecycle, and mobile input operations.
- `src/features/finance/api.ts` calls same-origin `/api/backend/finance*`, `/api/backend/ledger*`, `/api/backend/approvals*`, and private report summary endpoints for finance and approval operations.
- `src/features/public-reports/api.ts` calls configured backend `/reports/public/:rtCode/*` endpoints directly with `credentials: 'omit'` and without bearer tokens, `X-Tenant-Id`, or same-origin dashboard proxy usage.
- `src/lib/query/query-keys.ts` keeps private query keys prefixed by `['rt', rtId]`; public report keys remain under `['public', ...]`.
- Business rules, ledger math, permission enforcement, and public-safe serialization remain backend responsibilities.

## UI Foundations
- `src/components/ui`: shadcn-compatible primitives for button, input, label, dialog, sheet, dropdown menu, separator, and skeleton.
- `src/components/app-shell`: public shell, dashboard shell, sidebar, mobile navigation, topbar, and placeholder page.
- `src/components/feedback`: loading, error, empty, notification bell, and toaster foundations.
- `src/components/forms`: generic form section wrapper for future React Hook Form pages.
- `src/components/data-table`: generic responsive table foundation with empty state handling and no business-specific rendering.
- `src/features/structure`: Residents/Houses/Areas schemas, API adapter, hooks, action rules, forms, detail sheets, responsive list pages, and tests.
- `src/features/jimpitan`: Jimpitan schemas, API adapter, hooks, workflow helpers, lifecycle actions, session cards/forms, summary widgets, mobile item panel, session list/detail pages, mobile collection flow, and tests.
- `src/features/finance`: Finance/Ledger/Approval schemas, API adapter, hooks, workflow helpers, forms, badges, lifecycle confirmations, dashboard, account/category/transaction/ledger pages, approval pages, and tests.
- `src/features/public-reports`: public report response types, API adapter, Indonesian formatting helpers, route filter sanitizers, private-field payload guard, public report views, accessible CSS bar/table summaries, empty/loading/error coverage, and tests.

## Auth, Tenant, And Permissions
- `jimpitan_access_token` and `jimpitan_refresh_token` are httpOnly cookies set by Next route handlers after configured backend Auth responses.
- `jimpitan_session_meta` is an httpOnly cookie containing non-sensitive user, tenant, role, and permission metadata for server layout gating.
- Dashboard proxy treats either an access cookie or a refresh cookie plus session metadata as an auth hint, allowing expired access tokens to refresh through `/api/auth/session`.
- `/api/auth/session` loads backend `/auth/me`, `/users/me`, `/users/me/memberships`, and `/tenants/current`; it refreshes expired access tokens and avoids clearing cookies on refresh failure to prevent stale concurrent refresh responses from overwriting newer cookies.
- Invalid sessions are cleared through the explicit logout route from the auth error panel.
- Ambiguous multi-RT login returns a tenant-required state and reveals the RT identifier field without exposing token data.
- Multi-RT selection is isolated to the dashboard tenant provider; permissions remain scoped to the active tenant metadata, and tenants without a usable permission context require a fresh RT-scoped login before activation.
- Navigation is permission-aware, but backend RBAC remains authoritative for all API calls.
- Structure pages hide create/update/archive/reactivate actions based on `residents.*`, `houses.manage`, and `areas.manage` permissions, while backend RBAC and tenant isolation remain authoritative.
- Jimpitan pages hide create/start/checklist/submit/validate/reject/cancel/input actions based on `collections.*` permissions plus officer membership context, while backend lifecycle and RBAC checks remain authoritative.
- Finance pages hide create/update/delete/validate/post and approval decision actions based on `transactions.*` and `approvals.*` permissions, while backend ledger, approval, idempotency, and tenant checks remain authoritative.
- Resident-house assignment uses the backend move endpoint; house and area reactivation is not implemented in frontend because the backend exposes archive-only contracts for those resources.
- Raw Telegram binding identifiers are not editable from Residents UI; pages display bound/not-bound state only.
- Structure forms validate UUID-v4 identifiers to match backend DTOs, and client toasts suppress unexpected server error details while preserving actionable validation messages.

## Auth Security Posture
- State-changing auth session route handlers validate same-origin browser headers before persisting backend Auth responses.
- Backend Auth adapters are server-only modules and never enter client component imports.
- Browser code does not store access/refresh tokens in `localStorage`, `sessionStorage`, or `document.cookie`; login tokens are forwarded only to the same-origin session route for httpOnly cookie persistence.
- Login redirects are normalized to dashboard-relative paths only.
- Generic browser API client no longer accepts bearer token callbacks; privileged backend calls stay behind server route handlers.

## Responsive And Accessibility Standards
- Mobile-first layout uses a sheet-based private navigation pattern and a fixed desktop sidebar at `md` and above.
- The root layout includes a skip link and all major navigation blocks have `aria-label`.
- Loading states use skeletons with screen-reader labels; errors avoid sensitive details; empty states avoid fake business data.
- Buttons use icon primitives where appropriate and visible labels where commands need text clarity.

## Environment And Docker
- `env.example` documents required public API and optional app URLs.
- `apps/web/Dockerfile` builds with `npm ci`, Next standalone output, and static public assets.
- Runtime configuration must provide `NEXT_PUBLIC_API_BASE_URL`; deployment must keep auth token cookies secure and httpOnly.

## Verification
- `npm run test:web`
- `npm run typecheck:web`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 npm run build:web`
- `DATABASE_URL=postgresql://jimpitan:jimpitan@localhost:5432/jimpitan npm run prisma:validate`
- Frontend import-cycle scan over `apps/web/src`.
