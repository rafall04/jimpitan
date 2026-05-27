<!--
Purpose: Operational UX notes for the frontend Jimpitan collection workflow.
Caller: Frontend maintainers, product reviewers, and Codex agents extending Jimpitan pages.
Deps: docs/frontend/web-architecture.md, apps/web/src/features/jimpitan, apps/api/src/modules/jimpitan.
MainFuncs: Captures route structure, mode-aware mobile-first input rules, tenant/RBAC boundaries, cache strategy, and verification expectations.
SideEffects: None.
-->

# Jimpitan Operational UI Notes

## Implemented Routes
- `/dashboard/jimpitan`: operational dashboard with active officer routes and session filters.
- `/dashboard/jimpitan/sessions`: full collection session list and creation sheet.
- `/dashboard/jimpitan/sessions/[id]`: session detail, summaries, per-area progress, checklist, outstanding houses, lifecycle controls, and timeline.
- `/dashboard/jimpitan/mobile/[sessionId]`: mobile-first collection input that branches between house-by-house and bulk-total workflows.

## Operational UX Rules
- Field officers are the primary user. `PER_HOUSE` mobile flow uses large buttons, horizontal house selection, sticky progress, quick amount buttons, status chips, optional notes, and save-and-next behavior.
- `BULK_TOTAL` mobile flow shows a simplified total amount plus optional note form, and hides checklist, outstanding, and per-house progress controls.
- Duplicate input is prevented at the UI by single-house mutation disabling while pending and at the backend by session/house uniqueness.
- Validated, submitted, cancelled, or unauthorized sessions show locked input state instead of editable controls.
- Lifecycle actions are visible only when local permission and lifecycle helpers allow them; backend RBAC and status validation remain authoritative.
- Desktop detail pages prioritize dense operational visibility over presentation: totals, completion, outstanding houses, per-area progress, and latest checklist status.
- Session create/edit surfaces include a collection mode field. `PER_HOUSE` keeps checklist controls; `BULK_TOTAL` uses simplified total and optional note input. `HYBRID` remains hidden from selectable UI.

## Data And Cache Strategy
- Browser code calls only the same-origin backend proxy; backend bearer tokens remain httpOnly and server-side.
- All private query keys are tenant-prefixed through `queryKeys.jimpitan`.
- Item saves optimistically update only the current checklist row, roll back on error, then invalidate collection detail, checklist, summary, outstanding rows, and list scopes.
- Bulk total saves call the dedicated `bulk-total` endpoint and invalidate collection detail, checklist, summary, outstanding rows, and list scopes.
- User-facing error text keeps validation messages but suppresses unexpected server failure details.

## Boundaries
- Client validation mirrors DTO shape only: UUID/date/money/status/mode/note fields. Collection lifecycle, mode-specific requirements, duplicate prevention, archived entity checks, tenant isolation, audit logging, and finance hooks remain backend responsibilities.
- Finance posting, public transparency, Telegram UI, advanced analytics, and payment gateway flows are not implemented in this frontend module.

## Verification
- `npm run test:web`
- `npm run typecheck:web`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 npm run build:web`
- Frontend import-cycle scan over `apps/web/src`.
