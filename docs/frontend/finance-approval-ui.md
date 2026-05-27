<!--
Purpose: Frontend Finance, Ledger, and Approval UI architecture notes.
Caller: Frontend maintainers, product reviewers, and Codex agents extending finance workflows.
Deps: docs/frontend/web-architecture.md, apps/web/src/features/finance, apps/api/src/modules/finance, apps/api/src/modules/ledger, apps/api/src/modules/approvals.
MainFuncs: Captures route structure, mode-aware financial safety UX rules, data boundaries, cache strategy, and verification expectations.
SideEffects: None.
-->

# Finance And Approval UI Notes

## Implemented Routes
- `/dashboard/finance`: finance dashboard with backend ledger-derived summary, CSV export controls, pending queues, recent ledger entries, cash account balance rows, and validated collection posting.
- `/dashboard/reports`: private report export workspace with CSV creation, status, download, and failed retry controls.
- `/dashboard/finance/accounts`: cash account list/create/activate/archive UI.
- `/dashboard/finance/categories`: income/expense category list/create/activate/archive UI.
- `/dashboard/finance/transactions`: transaction list, income draft form, expense draft form, validation/rejection/void/post controls.
- `/dashboard/finance/transactions/[id]`: transaction detail, immutable posted-state display, approval state, rejection reason, and ledger row.
- `/dashboard/finance/ledger`: read-only append ledger table with sequence, direction, amount, balanceAfter, cash account filter, posted date, and transaction link.
- `/dashboard/approvals`: approval queue with approve/reject confirmation.
- `/dashboard/approvals/[id]`: approval detail, source transaction link, timeline, and decision controls.

## Financial Safety UX Rules
- Posted transactions display as immutable. The UI does not present edit controls for posted, rejected, or voided transactions.
- Ledger rows are read-only and link back to source transactions.
- Posting, rejection, voiding, and approval rejection require explicit confirmation dialogs. Rejection and void paths require reasons.
- Expense approval status is shown as a gate; the UI does not suggest direct posting can bypass pending approvals.
- Backend rejection reasons and validation errors are displayed when safe. Unexpected server errors are reduced to generic user-facing messages.

## Data Boundaries
- Browser code calls only same-origin `/api/backend/*`; backend access tokens remain httpOnly and server-side.
- Financial totals on the dashboard come from backend report summary/cash-flow endpoints, not client-side ledger aggregation.
- Client validation mirrors DTO shape only: UUID, date, positive money, key, and reason fields. Ledger sequence, idempotency, posting lifecycle, archived entity checks, approval policy, and tenant isolation remain backend responsibilities.
- Collection-to-finance posting uses the dedicated backend source collection endpoint and idempotency key. Duplicate source posting is backend-enforced for both `PER_HOUSE` and `BULK_TOTAL`; the selector labels collection mode and amount so total-only sessions are clear before posting.
- Report exports use same-origin `/api/backend/reports/exports` with the active tenant header. The UI does not expose private export download links until backend status is `COMPLETED`.
- Public-safe export creation is available from private pages but ledger and transaction export buttons remain private-only and require backend `reports.export` authorization.

## Cache Strategy
- All private query keys are tenant-prefixed through `queryKeys.finance` and `queryKeys.approvals`.
- Finance mutations invalidate finance, approval, and Jimpitan scopes where collection posting can change cross-module state.
- Approval decisions invalidate both approval queues and related transaction approval status/detail queries.
- Report export mutations invalidate tenant-scoped report export queries after creation or retry.

## Verification
- `npm run test:web`
- `npm run typecheck:web`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 npm run build:web`
- Frontend import-cycle scan over `apps/web/src`.
