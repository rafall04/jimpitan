<!--
Purpose: REST and OpenAPI notes for the Expense Approval workflow.
Caller: Backend maintainers, frontend/mobile clients, and OpenAPI reviewers.
Deps: apps/api/src/modules/approvals, apps/api/src/modules/finance, prisma/schema.prisma.
MainFuncs: Documents approval endpoints, policy model, lifecycle, RBAC, finance posting gate, hooks, and excluded workflows.
SideEffects: None.
-->

# Expense Approval API

## Scope
- Base path: `/api/v1/approvals`.
- Auth: bearer token plus tenant context guards on every endpoint.
- RBAC: `approvals.read`, `approvals.decide`, `transactions.validate`, `transactions.read`, `settings.read`, and `settings.update`.
- Status: workflow logic implemented for policies, threshold evaluation, request rows, decisions, cancellation, queues, finance posting gate, audit logs, and notification hooks.

## Routes
- `GET /approvals`
- `GET /approvals/queue`
- `GET /approvals/policy`
- `PATCH /approvals/policy`
- `GET /approvals/transactions/:transactionId/status`
- `POST /approvals/transactions/:transactionId/request`
- `GET /approvals/:approvalId`
- `POST /approvals/:approvalId/approve`
- `POST /approvals/:approvalId/reject`
- `POST /approvals/:approvalId/cancel`

## Safety Rules
- Every approval repository method receives `rtId`; no unscoped approval reads or writes.
- Expense approval policy is tenant configurable through settings key `expense_approval_policy`.
- Approval request assignment only targets active same-tenant memberships with configured approver roles.
- Self approval is blocked when policy requires it.
- Approval decisions are atomic and only allowed while the row is `PENDING`.
- Rejected approvals atomically move the related expense transaction to `REJECTED`.
- Finance posting rechecks approval completion before ledger posting and logs blocked attempts.
- Notification integration writes outbox rows; Telegram approval commands and Telegram delivery worker paths are implemented in the Telegram module.

## OpenAPI Notes
- DTOs live in `apps/api/src/modules/approvals/presentation/dto/approval.dto.ts`.
- Controller routes carry `ApiTags`, `ApiBearerAuth`, and `ApiOperation` decorators.
- `EXPIRED` is derived from `expiresAt` when listing state because the schema enum does not include a physical expired status.
