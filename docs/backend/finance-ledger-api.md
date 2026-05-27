<!--
Purpose: REST and OpenAPI notes for the Finance and Cash Ledger foundation.
Caller: Backend maintainers, frontend/mobile clients, and OpenAPI reviewers.
Deps: apps/api/src/modules/finance, apps/api/src/modules/ledger, prisma/schema.prisma.
MainFuncs: Documents implemented endpoints, DTO contracts, RBAC, ledger safety, and excluded workflows.
SideEffects: None.
-->

# Finance and Cash Ledger API

## Scope
- Base paths: `/api/v1/finance` and `/api/v1/ledger`.
- Auth: bearer token plus tenant context guards on every endpoint.
- RBAC: transaction permissions are used for finance and ledger foundation routes.
- Status: foundation logic implemented for cash accounts, categories, transaction lifecycle, source collection posting, ledger posting, and ledger reads.

## Finance Routes
- `GET/POST /finance/cash-accounts`
- `GET /finance/cash-accounts/default`
- `GET/PATCH /finance/cash-accounts/:cashAccountId`
- `GET /finance/cash-accounts/:cashAccountId/balance`
- `PATCH /finance/cash-accounts/:cashAccountId/archive`
- `GET/POST /finance/categories`
- `GET/PATCH /finance/categories/:categoryId`
- `PATCH /finance/categories/:categoryId/archive`
- `GET /finance/transactions`
- `POST /finance/transactions/income`
- `POST /finance/transactions/expense`
- `POST /finance/transactions/source-collections`
- `GET /finance/transactions/:transactionId`
- `PATCH /finance/transactions/:transactionId/validate`
- `PATCH /finance/transactions/:transactionId/reject`
- `PATCH /finance/transactions/:transactionId/void`
- `PATCH /finance/transactions/:transactionId/post`

## Ledger Routes
- `GET /ledger`
- `GET /ledger/:ledgerEntryId`
- `GET /ledger/cash-accounts/:cashAccountId/balance`

## Safety Rules
- Every repository method receives `rtId`; no unscoped finance reads or writes.
- Ledger rows are append-only and are never physically deleted by application workflows.
- Posting creates the transaction status change and ledger row in one database transaction.
- Ledger sequence is unique per account and generated under account-level transactional safety.
- Balance is derived from ledger rows and mirrored account balances are treated as denormalized state only.
- `sourceCollectionId` and idempotency keys prevent duplicate posting.
- Generic income/expense draft requests cannot attach `sourceCollectionId`; validated collections must use `POST /finance/transactions/source-collections`.
- Posted transaction and collection replay accepts the original idempotency key only; mismatched replay keys are rejected and audited.
- Expense transaction posting checks the approval policy and blocks ledger posting until required approvals are complete.
- Jimpitan collection posting remains decoupled through the hook/interface boundary.
- Transaction validation uses `VALIDATED`; posted transactions are immutable and draft-only voiding is enforced.

## OpenAPI Notes
- DTOs in `apps/api/src/modules/finance/presentation/dto` and `apps/api/src/modules/ledger/presentation/dto` carry Swagger decorators.
- Controllers carry `ApiTags`, `ApiBearerAuth`, and `ApiOperation` decorators.
- Finance and ledger implementation excludes reports, public transparency, payment gateway, and analytics dashboards; Telegram finance commands reuse exported finance services.
