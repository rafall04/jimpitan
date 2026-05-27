<!--
Purpose: REST/OpenAPI contract notes for the JIMPITAN notification module.
Caller: Backend maintainers, API clients, and Codex agents updating notification workflows.
Deps: apps/api/src/modules/notifications, prisma/schema.prisma, docs/backend/backend-skeleton.md.
MainFuncs: Documents notification endpoints, payloads, delivery lifecycle, idempotency, outbox behavior, RBAC, and excluded provider integrations.
SideEffects: None.
-->

# Notification API

## Scope
- Implemented: in-app notifications, recipient validation, outbox rows, delivery status lifecycle, retry/cancel, idempotency/dedupe replay, audit logs, tenant isolation, and RBAC.
- Telegram delivery is implemented through the Telegram module outbox adapter; email delivery remains an interface/no-op foundation.
- Excluded: email provider integration, reports engine, frontend UI.

## Notification Types
- `COLLECTION_ASSIGNED`
- `COLLECTION_SUBMITTED`
- `COLLECTION_VALIDATED`
- `EXPENSE_APPROVAL_REQUESTED`
- `EXPENSE_APPROVED`
- `EXPENSE_REJECTED`
- `TRANSACTION_POSTED`
- `MONTHLY_REPORT_READY`
- `SYSTEM_ALERT`

## Delivery Status
- `PENDING`: notification row is created and delivery outbox row is available.
- `SENT`: delivery worker or admin hook recorded a successful send.
- `FAILED`: delivery worker or admin hook recorded a failure and `failureReason`.
- `CANCELLED`: pending or failed delivery was cancelled.
- Read state is stored separately in `readAt`; `READ` is not used as the delivery lifecycle state.

## Endpoints
- `GET /api/v1/notifications`
  - Permission: `notifications.read`.
  - Returns current user's in-app notifications.
  - Query: `page`, `limit`, `type`, `channel`, `status`, `read`, `search`, `sortBy`, `sortDirection`.
- `POST /api/v1/notifications`
  - Permission: `notifications.manage`.
  - Creates one notification per recipient/channel pair.
  - Body: `type`, `title`, `body`, `channels`, `recipients`, optional `payload`, `idempotencyKey`, `dedupeKey`.
- `GET /api/v1/notifications/unread-count`
  - Permission: `notifications.read`.
  - Returns `{ unreadCount }`.
- `PATCH /api/v1/notifications/read-all`
  - Permission: `notifications.read`.
  - Marks all current user in-app notifications as read.
- `PATCH /api/v1/notifications/:notificationId/read`
  - Permission: `notifications.read`.
  - Marks one current user in-app notification as read.
- `GET /api/v1/notifications/admin/delivery`
  - Permission: `notifications.manage`.
  - Lists tenant-scoped delivery rows by status, channel, type, recipient, or search.
- `PATCH /api/v1/notifications/admin/:notificationId/cancel`
  - Permission: `notifications.manage`.
  - Cancels pending or failed delivery with a reason.
- `PATCH /api/v1/notifications/admin/:notificationId/retry`
  - Permission: `notifications.manage`.
  - Moves failed delivery back to `PENDING` and creates a new outbox event.
- `PATCH /api/v1/notifications/admin/:notificationId/delivery`
  - Permission: `notifications.manage`.
  - Queue-ready hook to record `SENT`, `FAILED`, `PENDING`, or `CANCELLED`.

## Safety Rules
- Every query and mutation is scoped by `actor.rtId`.
- Recipients must be active and same-tenant:
  - `userId`: active user with active RT membership.
  - `membershipId`: active membership with active user.
  - `residentId`: active, non-archived resident.
  - `telegramBindingId` or `telegramAccountId`: verified binding in the current RT and non-revoked Telegram account.
- `idempotencyKey` and `dedupeKey` replay existing rows only when the request fingerprint matches existing rows; mismatched replay attempts are rejected and audited.
- Notification row creation, outbox creation, and audit logging occur in one database transaction.
- Retry creates a fresh `NOTIFICATION_DELIVERY_REQUESTED` outbox row only when moving `FAILED` to `PENDING`; duplicate retry attempts against already-pending rows replay safely without new outbox rows.
- Delivery status transitions are constrained: final `SENT` rows cannot move back to `FAILED`, `PENDING`, or `CANCELLED`, and `CANCELLED` rows cannot be delivered later.
- Telegram provider delivery is handled by `TelegramService.processTelegramOutbox`, which validates tenant/aggregate/channel/account/status and active binding state before delivery; email delivery remains behind a no-op adapter until an email provider is implemented.
