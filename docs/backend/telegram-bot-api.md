<!--
Purpose: REST/OpenAPI and workflow notes for the JIMPITAN Telegram bot integration.
Caller: Backend maintainers, bot operators, API clients, and Codex agents updating Telegram workflows.
Deps: apps/api/src/modules/telegram, prisma/schema.prisma, docs/backend/backend-skeleton.md, docs/backend/notification-api.md.
MainFuncs: Documents Telegram webhook, binding, mode-aware command flows, outbox delivery, RBAC, tenant isolation, idempotency, and excluded integrations.
SideEffects: None.
-->

# Telegram Bot API

## Scope
- Implemented: webhook endpoint, update ingestion, account binding, tenant selection, role-aware menu, command routing, state machine, Jimpitan input, finance quick commands, approval actions, Telegram notification delivery adapter, audit logs, tenant isolation, and RBAC.
- Excluded: frontend UI, reports engine, payment gateway, public transparency pages, and email provider integration.

## Endpoints
- `POST /api/v1/telegram/webhook`
  - Public Telegram webhook endpoint.
- Verifies `x-telegram-bot-api-secret-token` against `BOT_WEBHOOK_SECRET` with constant-time comparison when configured.
- Stores each `update_id` once, redacts bind codes from stored payloads, and skips duplicate processing.
- `POST /api/v1/telegram/bind-codes`
  - Permission: `telegram.bind` or `telegram.manage`.
  - Creates a one-time bind code for an active same-tenant user/membership target.
- `POST /api/v1/telegram/outbox/drain`
  - Permission: `telegram.manage` or `notifications.manage`.
  - Claims pending Telegram notification outbox events and sends them through the Telegram sender adapter.

## Bot Commands
- `/start`: shows bind instructions.
- `/bind <code>`: verifies one-time code and creates a verified tenant binding.
- `/menu [rtCode]`: selects RT context and shows commands allowed by role permissions.
- `/help`: lists supported commands.
- `/saldo`: returns default cash account balance.
- `/jadwal`: lists current officer collection sessions.
- `/input_jimpitan`: stateful collection input; `PER_HOUSE` keeps house-by-house item input, while `BULK_TOTAL` asks only for total amount plus optional note.
- `/rekap_jimpitan`: returns latest collection summary.
- `/input_pemasukan`: creates an income draft.
- `/input_pengeluaran`: creates an expense draft.
- `/approval`: lists pending assigned approvals and accepts approve/reject replies.
- `/cancel`: clears tenant-scoped bot session state.

## Safety Rules
- Mode detection for `/input_jimpitan` reads the selected collection session before choosing a session state. `BULK_TOTAL` does not fetch checklists or create per-house items, and `PER_HOUSE` cannot bypass house-item validation.
- Telegram users are not authenticated until a verified `TelegramBinding` exists.
- Multi-RT users must select RT context explicitly or use a previously selected tenant session.
- Every business command and in-progress state transition resolves an `AuthPrincipal` from active tenant membership and checks permission keys before calling domain services.
- Money input accepts integer rupiah only.
- Incoming updates are idempotent by unique `TelegramUpdate.telegramUpdateId`.
- Approval decisions and notification outbox processing use conditional state transitions to avoid duplicate effects.
- Telegram outbox delivery validates aggregate id, tenant id, notification channel, Telegram account, active binding state, and delivery status before sending or mutating delivery state.
- Telegram sessions store only minimal state in tenant settings and are cleared on `/cancel`.
- Bot-side finance effects remain drafts unless the finance service lifecycle explicitly validates/posts them.
- Email delivery and Telegram command UI outside chat are not implemented.
