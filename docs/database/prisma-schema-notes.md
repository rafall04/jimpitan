<!--
Purpose: Database schema review notes for the JIMPITAN Prisma model.
Caller: Architects, DB reviewers, and implementation agents validating schema intent.
Deps: prisma/schema.prisma, docs/architecture/jimpitan-technical-architecture.md.
MainFuncs: Explains fixed schema issues, model purpose, collection modes, constraints, indexes, ledger consistency, and migration notes.
SideEffects: None.
-->

# JIMPITAN Prisma Schema Notes

## Review Issues Fixed

| Issue | Risk | Fix Applied |
|---|---|---|
| Core tenant relations used broad cascade delete. | Accidental RT/user deletion could erase financial, resident, notification, or operational history. | Changed core relations to `Restrict`; kept cascade only for join-table cleanup where explicit delete is safe. |
| Telegram binding lived directly on `Resident`. | One Telegram account could be reused inconsistently across RTs and resident/user contexts. | Added tenant-scoped `TelegramBinding` and `TelegramUpdate`; removed resident direct Telegram FK. |
| Missing idempotency keys. | Retries from REST, queue workers, reports, imports, approvals, notifications, or bot webhooks could duplicate writes. | Added idempotency/dedupe keys to transactions, collections, approvals, notifications, reports, imports, outbox, and Telegram updates. |
| Collection-to-transaction duplication was possible. | Validating the same collection twice could create duplicate income transactions. | Added unique `sourceCollectionId` on `Transaction`. |
| Ledger ordering was implicit. | Concurrent posting and reconciliation would be harder to prove correct. | Added `ledgerSequence` with unique `(cashAccountId, ledgerSequence)`. |
| Debit/credit enum was ambiguous for RT cash balance. | Misinterpreting accounting direction could invert balances. | Renamed ledger direction to `INCREASE` / `DECREASE`. |
| Expense approvals allowed duplicate approver rows. | Ketua RT could receive or decide duplicate approval records. | Added unique `(transactionId, approverMembershipId)` and approval idempotency key. |
| Attachments used only polymorphic `ownerId`. | Files could orphan or point to a wrong owner type without FK support. | Added explicit nullable FKs to transactions, report exports, resident imports, and announcements while retaining owner lookup fields. |
| Notifications deleted with recipient rows. | Notification history could disappear when a user/resident is removed. | Changed recipient relations to `SetNull`, added Telegram target and delivery failure fields. |
| Audit records could lose actor/RT references on physical delete. | Audit evidence would become less useful. | Changed audit user/RT relations to `Restrict`, added request/correlation IDs. |
| Missing lifecycle and actor fields. | Review, rejection, posting, deletion, and cancellation events lacked structured fields. | Added `createdById`, `updatedById`, `deletedById`, status timestamps, validation notes, rejection reasons, posting/voiding actors where relevant. |

## Model Explanation

- `Rt`: tenant root for every RT; soft-deletable and guarded by restrictive relations.
- `User`, `Session`: global identity and refresh-token session storage.
- `Role`, `Permission`, `RolePermission`, `RtMembership`, `UserRole`: RBAC and tenant membership.
- `Area`, `House`, `Resident`: RT geography, homes, and residents with soft-delete support.
- `TelegramAccount`, `TelegramBinding`, `TelegramUpdate`: global Telegram identity, per-RT verified bindings, and idempotent webhook processing.
- `CashAccount`: per-RT cash balance row used as the ledger lock target.
- `JimpitanSchedule`, `JimpitanCollection`, `CollectionItem`: officer assignment, mode-aware collection workflow, optional total-only collection totals, and per-house results.
- `TransactionCategory`, `Transaction`, `CashLedger`: finance category, transaction lifecycle, and immutable ledger entries.
- `ExpenseApproval`: threshold approval workflow for expenses.
- `Notification`: durable in-app, Telegram, or email notification state using `PENDING`, `SENT`, `FAILED`, and `CANCELLED` delivery lifecycle values; read state is tracked by `readAt`.
- `Attachment`: file metadata with explicit owner FKs and generic owner lookup fields.
- `AuditLog`: append-only audit evidence with request and correlation IDs.
- `Setting`, `Announcement`, `ReportExport`, `ResidentImport`, `OutboxEvent`: tenant config, public content, async exports/imports, and durable domain events.

## Key Database Constraints

- Every RT-owned domain model has `rtId`.
- Public RT lookup uses globally unique `rts.code`.
- Membership and role assignment are unique by tenant and user/role.
- Areas, houses, cash accounts, categories, and role keys are tenant-unique.
- Collection items are unique by `(collectionId, houseId)`.
- Transactions have unique tenant-scoped `referenceNumber`, `idempotencyKey`, and `externalRef`.
- One collection can create only one source transaction.
- One transaction can create only one ledger row.
- Ledger sequence is unique per cash account.
- One approver can have only one approval row per transaction.
- Telegram binding is unique per RT/account, RT/membership, and RT/resident.
- Notification/report/import idempotency keys prevent duplicate queue results; notification dedupe keys prevent duplicate recipient-channel fanout for business hooks.

## Indexing Strategy

- Tenant-scoped query indexes start with `rtId`.
- Date/status workflows use `(rtId, date/status, createdAt)` style indexes.
- Ledger history uses `(rtId, cashAccountId, ledgerDate, id)`.
- Collection route and validation queues index officer, date, schedule, and status.
- Mode-aware collection reporting and validation queues use `(rtId, collectionMode, status)` to separate `PER_HOUSE`, `BULK_TOTAL`, and `HYBRID` workflows without scanning all sessions.
- Collection route/date duplicate prevention is enforced in the repository with tenant-scoped count checks inside serializable create/update transactions because Prisma cannot express the desired active-status partial unique index portably.
- Finance/Ledger posting uses `TransactionStatus.VALIDATED`, serializable transactions with retry, tenant-scoped account version updates, unique `transactionId`, and unique `(cashAccountId, ledgerSequence)` to keep ledger sequence and balance writes atomic.
- Expense approval policy uses tenant setting key `expense_approval_policy`; approval rows use unique `(transactionId, approverMembershipId)` and tenant-scoped idempotency keys to prevent duplicate assignments.
- Audit lookup supports entity timeline, actor timeline, request ID, and correlation ID.
- Attachment lookup supports generic owner fields and explicit owner FKs.
- Outbox polling uses `(status, availableAt)`.
- Report export worker polling uses `(status, format, createdAt)` to claim queued CSV exports without scanning per-tenant indexes.
- Add manual PostgreSQL trigram index for resident name search during migration.

## Ledger Consistency Rules

- Jimpitan collection posting must use paid item sums for `PER_HOUSE` and `JimpitanCollection.totalAmount` for `BULK_TOTAL`, with `Transaction.sourceCollectionId` remaining unique to prevent double posting.
- Only `POSTED` transactions may create `CashLedger`.
- Posting must lock the `CashAccount` row and increment `version`.
- `CashAccount.currentBalance` must equal the newest ledger `balanceAfter`.
- Ledger amount must be positive; use `INCREASE` for income/positive adjustment and `DECREASE` for expense/negative adjustment.
- Validate expense balance before posting when negative cash is disabled.
- Never edit posted transactions in place; use `VOIDED` plus an adjustment transaction.
- Reconciliation must verify ledger sequence continuity, balance math, and transaction status.

## Migration Notes

- Use PostgreSQL `uuid` values generated by Prisma or enable `pgcrypto` if DB-generated UUIDs are preferred.
- Positive money fields, ledger balance math, non-negative balances, and append-only `cash_ledgers` are now enforced in migration `20260622120000_ledger_integrity_guards` (CHECK constraints + trigger). Still TODO: exactly-one attachment owner FK and notification-recipient-presence `CHECK`s.
- Add a manual `CHECK` constraint during migration so `BULK_TOTAL` collections have positive integer `total_amount` before `SUBMITTED`/`VALIDATED`; keep draft bulk sessions and `PER_HOUSE` item-derived totals compatible.
- Add manual partial unique indexes if system rows with nullable `rtId` need stricter uniqueness than PostgreSQL nullable unique semantics.
- Add `pg_trgm` and a trigram index on resident full name.
- Seed order: RT, permissions, roles, role permissions, users, memberships, cash account, categories, settings.
- Do not physically delete tenant, finance, resident, approval, or audit records in application flows; use status or soft delete fields.
