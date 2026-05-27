<!--
Purpose: Technical architecture blueprint and backend implementation status notes for JIMPITAN.
Caller: Product owner, architects, and implementation agents planning the platform.
Deps: SYSTEM_MAP.md, .module_map.md, docs/visual-planning/index.html.
MainFuncs: Defines backend, frontend, database, RBAC, APIs, queues, bot, security, deployment, and implementation phases.
SideEffects: None.
-->

# JIMPITAN Technical Architecture

## 1. Architecture Decision

### Recommended Approach
Use a modular monorepo with separate deployable apps:
- `apps/web`: Next.js public site and private dashboard.
- `apps/api`: NestJS REST API, RBAC, finance workflow, reports, uploads.
- `apps/bot`: Telegram bot worker using grammY or Telegraf.
- `packages/shared`: shared TypeScript types, API contracts, constants, permission keys.
- `packages/config`: shared env validation, lint, TypeScript, test config.

This keeps deployment scalable while preserving shared contracts and consistent domain language.

### Service Boundary
- Frontend never talks directly to PostgreSQL, Redis, S3, or Telegram.
- Backend API owns all write workflows, RBAC enforcement, audit logging, and ledger consistency.
- Bot calls backend application services directly only if deployed in the same Nest app; otherwise it uses internal REST endpoints protected by service tokens.
- Queue workers own asynchronous notifications, report generation, backups, and reminder jobs.

### Core Runtime
- Frontend: Next.js latest App Router, TypeScript, Tailwind CSS, shadcn/ui-compatible primitives, TanStack Query, React Hook Form, and Zod. Chart library selection remains deferred until dashboard modules.
- Backend: NestJS, TypeScript, Prisma, PostgreSQL, Swagger OpenAPI.
- Queue/cache: Redis, BullMQ.
- Bot: grammY preferred for small clean middleware and session support.
- Storage: S3-compatible provider with MinIO for local development.
- Deployment: Docker Compose initially, compatible with later Kubernetes or ECS migration.

## 2. Backend Architecture

### Layering
- `presentation`: controllers, request DTOs, Swagger decorators, guards.
- `application`: use cases, commands, queries, service orchestration, transactions.
- `domain`: enums, policies, permission constants, state machines, business rules.
- `infrastructure`: Prisma repositories, Redis, BullMQ producers, S3 storage, Telegram adapter, mail adapter.
- `common`: filters, interceptors, pipes, pagination, error classes, telemetry.

### Request Flow
1. HTTP request enters Nest controller.
2. Global validation pipe validates DTO.
3. Auth guard validates JWT/session.
4. Tenant guard resolves `rtId`.
5. Permission guard checks role permission or ownership policy.
6. Use case runs inside application layer.
7. Prisma repository performs DB work.
8. Audit event is written in the same DB transaction for sensitive changes.
9. Queue jobs are enqueued after durable write.
10. Response DTO returns public-safe payload.

### Backend Module Breakdown
- `auth`: login, refresh, logout, password hashing, sessions, JWT issuance.
- `users`: user CRUD, activation, role assignment.
- `rbac`: roles, permissions, policy guard, permission seed.
- `rt`: RT profile, areas, settings, multi-RT membership.
- `residents`: residents, houses, imports/exports, Telegram binding reference.
- `schedules`: jimpitan schedule generation, officer rotation, assignment.
- `collections`: collection sessions, collection items, validation, outstanding tracking.
- `finance`: transactions, categories, attachments, ledger entries, balance queries.
- `approvals`: expense approval workflow, threshold policy, approve/reject actions.
- `reports`: ledger-derived report queries, CSV export foundation, PDF/Excel provider interfaces, public-safe summaries.
- `notifications`: notification preferences, in-app notifications, Telegram/email dispatch.
- `telegram`: account binding, webhook handling, bot command authorization.
- `audit`: immutable audit log writer and query endpoints.
- `attachments`: upload policy, presigned URL, malware-scan job event, metadata.
- `settings`: per-RT settings, thresholds, schedule rules, public visibility.
- `jobs`: cron orchestration, BullMQ processors, retry/dead-letter handling.
- `health`: readiness, liveness, metrics.

## 3. Database Schema

### Tenancy Model
Every RT-owned table includes `rt_id`. Users can belong to multiple RTs through `rt_memberships`. All queries must scope by `rt_id` except super-admin platform operations.

### Tables

#### `rts`
- `id uuid pk`
- `name varchar(120)`
- `code varchar(40) unique`
- `address text`
- `timezone varchar(64) default 'Asia/Jakarta'`
- `is_active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`
- Index: `code`, `is_active`

#### `users`
- `id uuid pk`
- `full_name varchar(160)`
- `email varchar(160) unique nullable`
- `phone varchar(32) unique nullable`
- `password_hash text nullable`
- `status enum ACTIVE|INACTIVE|LOCKED`
- `last_login_at timestamptz nullable`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz nullable`
- Index: `status`, `deleted_at`

#### `sessions`
- `id uuid pk`
- `user_id uuid fk users`
- `refresh_token_hash text`
- `user_agent text`
- `ip_address inet nullable`
- `expires_at timestamptz`
- `revoked_at timestamptz nullable`
- `created_at timestamptz`
- Index: `(user_id, revoked_at)`, `expires_at`

#### `roles`
- `id uuid pk`
- `rt_id uuid fk rts nullable`
- `key varchar(80)`
- `name varchar(120)`
- `description text nullable`
- `is_system boolean`
- Unique: `(rt_id, key)`

#### `permissions`
- `id uuid pk`
- `key varchar(120) unique`
- `description text`
- `module varchar(80)`

#### `role_permissions`
- `role_id uuid fk roles`
- `permission_id uuid fk permissions`
- PK: `(role_id, permission_id)`

#### `rt_memberships`
- `id uuid pk`
- `rt_id uuid fk rts`
- `user_id uuid fk users`
- `status enum ACTIVE|INACTIVE`
- `created_at timestamptz`
- Unique: `(rt_id, user_id)`
- Index: `(user_id, status)`

#### `user_roles`
- `membership_id uuid fk rt_memberships`
- `role_id uuid fk roles`
- PK: `(membership_id, role_id)`

#### `areas`
- `id uuid pk`
- `rt_id uuid fk rts`
- `code varchar(40)`
- `name varchar(120)`
- `sort_order int`
- `is_active boolean`
- Unique: `(rt_id, code)`

#### `houses`
- `id uuid pk`
- `rt_id uuid fk rts`
- `area_id uuid fk areas`
- `house_number varchar(40)`
- `address_note text nullable`
- `status enum OCCUPIED|EMPTY|INACTIVE`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz nullable`
- Unique: `(rt_id, house_number)`
- Index: `(rt_id, area_id, status)`

#### `residents`
- `id uuid pk`
- `rt_id uuid fk rts`
- `house_id uuid fk houses`
- `full_name varchar(160)`
- `phone varchar(32) nullable`
- `telegram_account_id uuid nullable`
- `status enum ACTIVE|INACTIVE|MOVED`
- `default_jimpitan_amount decimal(14,2)`
- `notes text nullable`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz nullable`
- Index: `(rt_id, house_id, status)`, `full_name gin_trgm_ops`

#### `telegram_accounts`
- `id uuid pk`
- `telegram_user_id varchar(64) unique`
- `username varchar(120) nullable`
- `display_name varchar(160) nullable`
- `linked_user_id uuid fk users nullable`
- `linked_resident_id uuid fk residents nullable`
- `verified_at timestamptz nullable`
- `created_at timestamptz`
- Index: `linked_user_id`, `linked_resident_id`

#### `jimpitan_schedules`
- `id uuid pk`
- `rt_id uuid fk rts`
- `area_id uuid fk areas nullable`
- `officer_membership_id uuid fk rt_memberships`
- `schedule_date date`
- `schedule_type enum WEEKLY|MONTHLY|CUSTOM`
- `status enum SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED`
- `created_by uuid fk users`
- `created_at timestamptz`
- `updated_at timestamptz`
- Unique: `(rt_id, officer_membership_id, schedule_date, area_id)`
- Index: `(rt_id, schedule_date, status)`

#### `jimpitan_collections`
- `id uuid pk`
- `rt_id uuid fk rts`
- `schedule_id uuid fk jimpitan_schedules nullable`
- `officer_membership_id uuid fk rt_memberships`
- `collection_date date`
- `status enum DRAFT|SUBMITTED|VALIDATED|REJECTED`
- `submitted_at timestamptz nullable`
- `validated_by uuid fk users nullable`
- `validated_at timestamptz nullable`
- `total_amount decimal(14,2)`
- `created_at timestamptz`
- `updated_at timestamptz`
- Index: `(rt_id, collection_date, status)`, `(rt_id, officer_membership_id, collection_date)`

#### `collection_items`
- `id uuid pk`
- `rt_id uuid fk rts`
- `collection_id uuid fk jimpitan_collections`
- `house_id uuid fk houses`
- `resident_id uuid fk residents nullable`
- `amount decimal(14,2)`
- `status enum PAID|UNPAID|HOUSE_EMPTY|LEFT_WITH_NEIGHBOR|OVERDUE|DISPENSATION`
- `note text nullable`
- `created_at timestamptz`
- `updated_at timestamptz`
- Unique: `(collection_id, house_id)`
- Index: `(rt_id, house_id, status)`, `(rt_id, status, created_at)`

#### `transaction_categories`
- `id uuid pk`
- `rt_id uuid fk rts nullable`
- `type enum INCOME|EXPENSE|TRANSFER|ADJUSTMENT`
- `key varchar(80)`
- `name varchar(120)`
- `is_system boolean`
- `is_active boolean`
- Unique: `(rt_id, key, type)`

#### `transactions`
- `id uuid pk`
- `rt_id uuid fk rts`
- `category_id uuid fk transaction_categories`
- `source_collection_id uuid fk jimpitan_collections nullable`
- `type enum INCOME|EXPENSE|TRANSFER|ADJUSTMENT`
- `status enum DRAFT|PENDING_VALIDATION|PENDING_APPROVAL|APPROVED|REJECTED|POSTED|VOIDED`
- `amount decimal(14,2)`
- `description text`
- `transaction_date date`
- `created_by uuid fk users`
- `validated_by uuid fk users nullable`
- `validated_at timestamptz nullable`
- `posted_at timestamptz nullable`
- `deleted_at timestamptz nullable`
- `created_at timestamptz`
- `updated_at timestamptz`
- Index: `(rt_id, transaction_date, type)`, `(rt_id, status)`, `(rt_id, category_id, transaction_date)`

#### `cash_ledgers`
- `id uuid pk`
- `rt_id uuid fk rts`
- `transaction_id uuid fk transactions unique`
- `entry_type enum INCREASE|DECREASE`
- `amount decimal(14,2)`
- `balance_after decimal(14,2)`
- `ledger_date timestamptz`
- `created_at timestamptz`
- Index: `(rt_id, ledger_date)`, `(rt_id, id)`

#### `expense_approvals`
- `id uuid pk`
- `rt_id uuid fk rts`
- `transaction_id uuid fk transactions`
- `requested_by uuid fk users`
- `approver_membership_id uuid fk rt_memberships`
- `status enum PENDING|APPROVED|REJECTED|CANCELLED`
- `reason text nullable`
- `decision_note text nullable`
- `decided_at timestamptz nullable`
- `created_at timestamptz`
- `updated_at timestamptz`
- Index: `(rt_id, status, created_at)`, `(approver_membership_id, status)`

#### `notifications`
- `id uuid pk`
- `rt_id uuid fk rts`
- `recipient_user_id uuid fk users nullable`
- `recipient_resident_id uuid fk residents nullable`
- `telegram_account_id uuid fk telegram_accounts nullable`
- `idempotency_key varchar(120) nullable`
- `dedupe_key varchar(160) nullable`
- `channel enum IN_APP|TELEGRAM|EMAIL`
- `type varchar(80)`
- `title varchar(160)`
- `body text`
- `status enum PENDING|SENT|FAILED|CANCELLED`
- `payload jsonb`
- `failure_reason text nullable`
- `sent_at timestamptz nullable`
- `failed_at timestamptz nullable`
- `read_at timestamptz nullable`
- `created_at timestamptz`
- Unique: `(rt_id, idempotency_key)`, `(rt_id, dedupe_key)`
- Index: `(rt_id, recipient_user_id, status)`, `(rt_id, recipient_resident_id, status)`, `(rt_id, channel, status)`, `(rt_id, type, created_at)`

#### `attachments`
- `id uuid pk`
- `rt_id uuid fk rts`
- `owner_type enum TRANSACTION|REPORT|RESIDENT_IMPORT`
- `owner_id uuid`
- `bucket varchar(120)`
- `object_key text`
- `file_name varchar(255)`
- `mime_type varchar(120)`
- `size_bytes bigint`
- `checksum varchar(128) nullable`
- `uploaded_by uuid fk users`
- `created_at timestamptz`
- Index: `(rt_id, owner_type, owner_id)`

#### `audit_logs`
- `id uuid pk`
- `rt_id uuid fk rts nullable`
- `actor_user_id uuid fk users nullable`
- `actor_type enum USER|SYSTEM|BOT`
- `action varchar(120)`
- `entity_type varchar(80)`
- `entity_id uuid nullable`
- `before_data jsonb nullable`
- `after_data jsonb nullable`
- `ip_address inet nullable`
- `user_agent text nullable`
- `created_at timestamptz`
- Index: `(rt_id, entity_type, entity_id)`, `(rt_id, actor_user_id, created_at)`, `(action, created_at)`

#### `settings`
- `id uuid pk`
- `rt_id uuid fk rts`
- `key varchar(120)`
- `value jsonb`
- `updated_by uuid fk users nullable`
- `updated_at timestamptz`
- Unique: `(rt_id, key)`

#### `outbox_events`
- `id uuid pk`
- `rt_id uuid fk rts nullable`
- `event_type varchar(120)`
- `aggregate_type varchar(80)`
- `aggregate_id uuid`
- `payload jsonb`
- `status enum PENDING|PROCESSING|PROCESSED|FAILED`
- `attempts int`
- `available_at timestamptz`
- `created_at timestamptz`
- `processed_at timestamptz nullable`
- Index: `(status, available_at)`, `(rt_id, event_type, created_at)`

### Index and Cardinality Rules
- High-cardinality filters: `rt_id`, dates, status, category, officer, house.
- Use composite indexes with `rt_id` first for tenant-scoped queries.
- Use trigram index for resident name search.
- Never query collections or transactions without `rt_id`.
- Report queries must use date ranges and pagination/export jobs for large ranges.

## 4. Prisma Schema Blueprint

This is a planning blueprint for the future `schema.prisma`; it must not be copied without adding final migrations, comments, and generated relation names.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserStatus { ACTIVE INACTIVE LOCKED }
enum MembershipStatus { ACTIVE INACTIVE }
enum HouseStatus { OCCUPIED EMPTY INACTIVE }
enum ResidentStatus { ACTIVE INACTIVE MOVED }
enum ScheduleType { WEEKLY MONTHLY CUSTOM }
enum ScheduleStatus { SCHEDULED IN_PROGRESS COMPLETED CANCELLED }
enum CollectionStatus { DRAFT SUBMITTED VALIDATED REJECTED }
enum CollectionItemStatus { PAID UNPAID HOUSE_EMPTY LEFT_WITH_NEIGHBOR OVERDUE DISPENSATION }
enum TransactionType { INCOME EXPENSE TRANSFER ADJUSTMENT }
enum TransactionStatus { DRAFT VALIDATED PENDING_VALIDATION PENDING_APPROVAL APPROVED REJECTED POSTED VOIDED }
enum LedgerEntryType { INCREASE DECREASE }
enum ApprovalStatus { PENDING APPROVED REJECTED CANCELLED }
enum NotificationChannel { IN_APP TELEGRAM EMAIL }
enum NotificationStatus { PENDING SENT FAILED CANCELLED }
enum AttachmentOwnerType { TRANSACTION REPORT RESIDENT_IMPORT }
enum AuditActorType { USER SYSTEM BOT }
enum OutboxStatus { PENDING PROCESSING PROCESSED FAILED }

model Rt {
  id        String   @id @default(uuid()) @db.Uuid
  name      String   @db.VarChar(120)
  code      String   @unique @db.VarChar(40)
  address   String?
  timezone  String   @default("Asia/Jakarta") @db.VarChar(64)
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz

  memberships RtMembership[]
  areas       Area[]
  houses      House[]
  residents   Resident[]
  schedules   JimpitanSchedule[]
  collections JimpitanCollection[]
  transactions Transaction[]
  ledgers     CashLedger[]

  @@map("rts")
}

model User {
  id           String     @id @default(uuid()) @db.Uuid
  fullName     String     @map("full_name") @db.VarChar(160)
  email        String?    @unique @db.VarChar(160)
  phone        String?    @unique @db.VarChar(32)
  passwordHash String?    @map("password_hash")
  status       UserStatus @default(ACTIVE)
  lastLoginAt  DateTime?  @map("last_login_at") @db.Timestamptz
  createdAt    DateTime   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime   @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt    DateTime?  @map("deleted_at") @db.Timestamptz

  sessions    Session[]
  memberships RtMembership[]

  @@index([status, deletedAt])
  @@map("users")
}

model Session {
  id               String    @id @default(uuid()) @db.Uuid
  userId           String    @map("user_id") @db.Uuid
  refreshTokenHash String    @map("refresh_token_hash")
  userAgent        String?   @map("user_agent")
  ipAddress        String?   @map("ip_address") @db.Inet
  expiresAt        DateTime  @map("expires_at") @db.Timestamptz
  revokedAt        DateTime? @map("revoked_at") @db.Timestamptz
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id])

  @@index([userId, revokedAt])
  @@index([expiresAt])
  @@map("sessions")
}

model Role {
  id          String  @id @default(uuid()) @db.Uuid
  rtId        String? @map("rt_id") @db.Uuid
  key         String  @db.VarChar(80)
  name        String  @db.VarChar(120)
  description String?
  isSystem    Boolean @default(false) @map("is_system")

  permissions RolePermission[]
  userRoles   UserRole[]

  @@unique([rtId, key])
  @@map("roles")
}

model Permission {
  id          String @id @default(uuid()) @db.Uuid
  key         String @unique @db.VarChar(120)
  description String
  module      String @db.VarChar(80)

  roles RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId       String @map("role_id") @db.Uuid
  permissionId String @map("permission_id") @db.Uuid

  role       Role       @relation(fields: [roleId], references: [id])
  permission Permission @relation(fields: [permissionId], references: [id])

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model RtMembership {
  id        String           @id @default(uuid()) @db.Uuid
  rtId      String           @map("rt_id") @db.Uuid
  userId    String           @map("user_id") @db.Uuid
  status    MembershipStatus @default(ACTIVE)
  createdAt DateTime         @default(now()) @map("created_at") @db.Timestamptz

  rt    Rt @relation(fields: [rtId], references: [id])
  user  User @relation(fields: [userId], references: [id])
  roles UserRole[]

  @@unique([rtId, userId])
  @@index([userId, status])
  @@map("rt_memberships")
}

model UserRole {
  membershipId String @map("membership_id") @db.Uuid
  roleId       String @map("role_id") @db.Uuid

  membership RtMembership @relation(fields: [membershipId], references: [id])
  role       Role         @relation(fields: [roleId], references: [id])

  @@id([membershipId, roleId])
  @@map("user_roles")
}

model Area {
  id        String  @id @default(uuid()) @db.Uuid
  rtId      String  @map("rt_id") @db.Uuid
  code      String  @db.VarChar(40)
  name      String  @db.VarChar(120)
  sortOrder Int     @default(0) @map("sort_order")
  isActive  Boolean @default(true) @map("is_active")

  rt Rt @relation(fields: [rtId], references: [id])
  houses House[]

  @@unique([rtId, code])
  @@map("areas")
}

model House {
  id          String      @id @default(uuid()) @db.Uuid
  rtId        String      @map("rt_id") @db.Uuid
  areaId      String      @map("area_id") @db.Uuid
  houseNumber String      @map("house_number") @db.VarChar(40)
  addressNote String?     @map("address_note")
  status      HouseStatus @default(OCCUPIED)
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime    @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt   DateTime?   @map("deleted_at") @db.Timestamptz

  rt   Rt   @relation(fields: [rtId], references: [id])
  area Area @relation(fields: [areaId], references: [id])
  residents Resident[]
  collectionItems CollectionItem[]

  @@unique([rtId, houseNumber])
  @@index([rtId, areaId, status])
  @@map("houses")
}

model Resident {
  id                    String         @id @default(uuid()) @db.Uuid
  rtId                  String         @map("rt_id") @db.Uuid
  houseId               String         @map("house_id") @db.Uuid
  fullName              String         @map("full_name") @db.VarChar(160)
  phone                 String?        @db.VarChar(32)
  telegramAccountId     String?        @map("telegram_account_id") @db.Uuid
  status                ResidentStatus @default(ACTIVE)
  defaultJimpitanAmount Decimal        @default(2000) @map("default_jimpitan_amount") @db.Decimal(14, 2)
  notes                 String?
  createdAt             DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime       @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt             DateTime?      @map("deleted_at") @db.Timestamptz

  rt    Rt    @relation(fields: [rtId], references: [id])
  house House @relation(fields: [houseId], references: [id])

  @@index([rtId, houseId, status])
  @@map("residents")
}

model JimpitanSchedule {
  id                  String         @id @default(uuid()) @db.Uuid
  rtId                String         @map("rt_id") @db.Uuid
  areaId              String?        @map("area_id") @db.Uuid
  officerMembershipId String         @map("officer_membership_id") @db.Uuid
  scheduleDate        DateTime       @map("schedule_date") @db.Date
  scheduleType        ScheduleType   @map("schedule_type")
  status              ScheduleStatus @default(SCHEDULED)
  createdBy           String         @map("created_by") @db.Uuid
  createdAt           DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime       @updatedAt @map("updated_at") @db.Timestamptz

  rt Rt @relation(fields: [rtId], references: [id])
  collections JimpitanCollection[]

  @@unique([rtId, officerMembershipId, scheduleDate, areaId])
  @@index([rtId, scheduleDate, status])
  @@map("jimpitan_schedules")
}

model JimpitanCollection {
  id                  String           @id @default(uuid()) @db.Uuid
  rtId                String           @map("rt_id") @db.Uuid
  scheduleId          String?          @map("schedule_id") @db.Uuid
  officerMembershipId String           @map("officer_membership_id") @db.Uuid
  collectionDate      DateTime         @map("collection_date") @db.Date
  status              CollectionStatus @default(DRAFT)
  submittedAt         DateTime?        @map("submitted_at") @db.Timestamptz
  validatedBy         String?          @map("validated_by") @db.Uuid
  validatedAt         DateTime?        @map("validated_at") @db.Timestamptz
  totalAmount         Decimal          @default(0) @map("total_amount") @db.Decimal(14, 2)
  createdAt           DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime         @updatedAt @map("updated_at") @db.Timestamptz

  rt       Rt @relation(fields: [rtId], references: [id])
  schedule JimpitanSchedule? @relation(fields: [scheduleId], references: [id])
  items    CollectionItem[]

  @@index([rtId, collectionDate, status])
  @@index([rtId, officerMembershipId, collectionDate])
  @@map("jimpitan_collections")
}

model CollectionItem {
  id           String               @id @default(uuid()) @db.Uuid
  rtId         String               @map("rt_id") @db.Uuid
  collectionId String               @map("collection_id") @db.Uuid
  houseId      String               @map("house_id") @db.Uuid
  residentId   String?              @map("resident_id") @db.Uuid
  amount       Decimal              @default(0) @db.Decimal(14, 2)
  status       CollectionItemStatus
  note         String?
  createdAt    DateTime             @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime             @updatedAt @map("updated_at") @db.Timestamptz

  collection JimpitanCollection @relation(fields: [collectionId], references: [id])
  house      House              @relation(fields: [houseId], references: [id])

  @@unique([collectionId, houseId])
  @@index([rtId, houseId, status])
  @@index([rtId, status, createdAt])
  @@map("collection_items")
}

model TransactionCategory {
  id       String          @id @default(uuid()) @db.Uuid
  rtId     String?         @map("rt_id") @db.Uuid
  type     TransactionType
  key      String          @db.VarChar(80)
  name     String          @db.VarChar(120)
  isSystem Boolean         @default(false) @map("is_system")
  isActive Boolean         @default(true) @map("is_active")

  transactions Transaction[]

  @@unique([rtId, key, type])
  @@map("transaction_categories")
}

model Transaction {
  id                 String            @id @default(uuid()) @db.Uuid
  rtId               String            @map("rt_id") @db.Uuid
  categoryId         String            @map("category_id") @db.Uuid
  sourceCollectionId String?           @map("source_collection_id") @db.Uuid
  type               TransactionType
  status             TransactionStatus @default(DRAFT)
  amount             Decimal           @db.Decimal(14, 2)
  description        String
  transactionDate    DateTime          @map("transaction_date") @db.Date
  createdBy          String            @map("created_by") @db.Uuid
  validatedBy        String?           @map("validated_by") @db.Uuid
  validatedAt        DateTime?         @map("validated_at") @db.Timestamptz
  postedAt           DateTime?         @map("posted_at") @db.Timestamptz
  deletedAt          DateTime?         @map("deleted_at") @db.Timestamptz
  createdAt          DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt          DateTime          @updatedAt @map("updated_at") @db.Timestamptz

  rt       Rt @relation(fields: [rtId], references: [id])
  category TransactionCategory @relation(fields: [categoryId], references: [id])
  ledger   CashLedger?
  approvals ExpenseApproval[]

  @@index([rtId, transactionDate, type])
  @@index([rtId, status])
  @@index([rtId, categoryId, transactionDate])
  @@map("transactions")
}

model CashLedger {
  id             String          @id @default(uuid()) @db.Uuid
  rtId           String          @map("rt_id") @db.Uuid
  transactionId  String          @unique @map("transaction_id") @db.Uuid
  entryType      LedgerEntryType @map("entry_type")
  amount         Decimal         @db.Decimal(14, 2)
  balanceAfter   Decimal         @map("balance_after") @db.Decimal(14, 2)
  ledgerDate     DateTime        @map("ledger_date") @db.Timestamptz
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz

  rt          Rt @relation(fields: [rtId], references: [id])
  transaction Transaction @relation(fields: [transactionId], references: [id])

  @@index([rtId, ledgerDate])
  @@map("cash_ledgers")
}

model ExpenseApproval {
  id                   String         @id @default(uuid()) @db.Uuid
  rtId                 String         @map("rt_id") @db.Uuid
  transactionId         String         @map("transaction_id") @db.Uuid
  requestedBy           String         @map("requested_by") @db.Uuid
  approverMembershipId  String         @map("approver_membership_id") @db.Uuid
  status                ApprovalStatus @default(PENDING)
  reason                String?
  decisionNote          String?        @map("decision_note")
  decidedAt             DateTime?      @map("decided_at") @db.Timestamptz
  createdAt             DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime       @updatedAt @map("updated_at") @db.Timestamptz

  transaction Transaction @relation(fields: [transactionId], references: [id])

  @@index([rtId, status, createdAt])
  @@index([approverMembershipId, status])
  @@map("expense_approvals")
}
```

## 5. RBAC Permission Matrix

### Permission Keys
- `auth.session.manage`
- `users.read`, `users.create`, `users.update`, `users.deactivate`, `users.roles.manage`
- `roles.read`, `roles.manage`, `permissions.read`
- `residents.read`, `residents.create`, `residents.update`, `residents.delete`, `residents.import`, `residents.export`
- `houses.read`, `houses.manage`
- `areas.read`, `areas.manage`
- `schedules.read`, `schedules.manage`, `schedules.assign`
- `collections.read`, `collections.create`, `collections.update_own`, `collections.submit_own`, `collections.validate`, `collections.reject`
- `transactions.read`, `transactions.create`, `transactions.update`, `transactions.delete`, `transactions.validate`, `transactions.post`
- `approvals.read`, `approvals.decide`
- `reports.public.read`, `reports.private.read`, `reports.export`, `reports.publish`
- `notifications.read`, `notifications.manage`
- `telegram.bind`, `telegram.manage`
- `audit.read`
- `settings.read`, `settings.update`
- `backup.manage`, `monitoring.read`

### Matrix
| Module | Super Admin | Ketua RT | Bendahara | Petugas Keliling | Warga |
|---|---:|---:|---:|---:|---:|
| System settings | full | read/update RT settings | read finance settings | none | none |
| User management | full | read | none | none | own profile |
| Roles/permissions | full | read | none | none | none |
| Residents/houses | full | read | full | route read | own/public only |
| Schedules | full | read/manage | manage | own schedule read | public schedule read |
| Collections | full | read | validate/manage | create/update/submit own | own contribution read |
| Transactions | full | read | full except approval decision | none | public summaries |
| Expense approvals | full | decide | request/read | none | none |
| Reports | full | private/export/publish | private/export/create | own performance | public reports |
| Telegram | full | read | manage bindings | bind own | bind own |
| Audit logs | full | read | read finance-related | none | none |
| Backup/monitoring | full | read monitoring | none | none | none |

### Enforcement Rules
- Role grants are additive.
- Tenant membership is required for private endpoints.
- Super Admin can operate across RTs but must provide explicit `rtId` when reading tenant data.
- Ownership policies supplement RBAC for officer-owned draft collections and resident self-view.
- Public transparency endpoints use a separate public policy and never expose private notes, resident phone numbers, Telegram IDs, or raw audit data.

## 6. API Contract Structure

### Conventions
- Base URL: `/api/v1`.
- Auth: `Authorization: Bearer <access_token>`.
- Tenant: `X-RT-ID` for multi-RT users; single-RT users can infer default RT.
- Pagination: `page`, `limit`, `sort`, `order`.
- Date filters: ISO dates, inclusive start and end.
- Response envelope:
  - `data`: payload.
  - `meta`: pagination or request metadata.
  - `error`: structured error only on failure.

### Error Envelope
```json
{
  "error": {
    "code": "FINANCE_INSUFFICIENT_BALANCE",
    "message": "Insufficient cash balance for this expense.",
    "details": {
      "availableBalance": "120000.00",
      "requestedAmount": "250000.00"
    },
    "requestId": "req_01H..."
  }
}
```

### DTO Strategy
- Request DTOs validate shape and primitive constraints.
- Domain policies validate cross-record rules.
- Response DTOs hide private fields by default.
- Public endpoints use dedicated public response DTOs.

## 7. REST Endpoint Planning

### Auth
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/password/change`

### Users and RBAC
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/:id`
- `PATCH /api/v1/users/:id`
- `POST /api/v1/users/:id/activate`
- `POST /api/v1/users/:id/deactivate`
- `PUT /api/v1/users/:id/roles`
- `GET /api/v1/roles`
- `POST /api/v1/roles`
- `PATCH /api/v1/roles/:id`
- `GET /api/v1/permissions`

### RT, Areas, Houses
- `GET /api/v1/rt/current`
- `PATCH /api/v1/rt/current`
- `GET /api/v1/areas`
- `POST /api/v1/areas`
- `PATCH /api/v1/areas/:id`
- `GET /api/v1/houses`
- `POST /api/v1/houses`
- `GET /api/v1/houses/:id`
- `PATCH /api/v1/houses/:id`
- `DELETE /api/v1/houses/:id`

### Residents
- `GET /api/v1/residents`
- `POST /api/v1/residents`
- `GET /api/v1/residents/:id`
- `PATCH /api/v1/residents/:id`
- `DELETE /api/v1/residents/:id`
- `POST /api/v1/residents/imports`
- `GET /api/v1/residents/export`

### Schedules and Collections
- `GET /api/v1/schedules`
- `POST /api/v1/schedules`
- `POST /api/v1/schedules/generate`
- `PATCH /api/v1/schedules/:id`
- `GET /api/v1/collections`
- `POST /api/v1/collections`
- `GET /api/v1/collections/:id`
- `PATCH /api/v1/collections/:id`
- `PUT /api/v1/collections/:id/items`
- `POST /api/v1/collections/:id/submit`
- `POST /api/v1/collections/:id/validate`
- `POST /api/v1/collections/:id/reject`
- `GET /api/v1/collections/outstanding`

### Finance and Approvals
- `GET /api/v1/transactions`
- `POST /api/v1/transactions`
- `GET /api/v1/transactions/:id`
- `PATCH /api/v1/transactions/:id`
- `DELETE /api/v1/transactions/:id`
- `POST /api/v1/transactions/:id/validate`
- `POST /api/v1/transactions/:id/post`
- `GET /api/v1/transaction-categories`
- `POST /api/v1/transaction-categories`
- `GET /api/v1/cash-ledgers`
- `GET /api/v1/cash-ledgers/balance`
- `GET /api/v1/approvals`
- `GET /api/v1/approvals/:id`
- `POST /api/v1/approvals/:id/approve`
- `POST /api/v1/approvals/:id/reject`

### Reports, Public, Notifications
- `GET /api/v1/reports/finance/summary`
- `GET /api/v1/reports/finance/cash-flow`
- `GET /api/v1/reports/finance/expense-categories`
- `GET /api/v1/reports/collections/performance`
- `GET /api/v1/reports/collections/per-area-progress`
- `GET /api/v1/reports/outstanding/houses`
- `GET /api/v1/reports/approvals/activity`
- `GET /api/v1/reports/audit/activity`
- `POST /api/v1/reports/exports`
- `GET /api/v1/reports/exports`
- `GET /api/v1/reports/exports/:id`
- `GET /api/v1/reports/public/:rtCode/summary`
- `GET /api/v1/reports/public/:rtCode/monthly-finance`
- `GET /api/v1/reports/public/:rtCode/metadata`
- `GET /api/v1/reports/public/:rtCode/announcements`
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/unread-count`
- `PATCH /api/v1/notifications/read-all`
- `PATCH /api/v1/notifications/:notificationId/read`
- `POST /api/v1/notifications`
- `GET /api/v1/notifications/admin/delivery`
- `PATCH /api/v1/notifications/admin/:notificationId/cancel`
- `PATCH /api/v1/notifications/admin/:notificationId/retry`
- `PATCH /api/v1/notifications/admin/:notificationId/delivery`

### Telegram, Audit, Attachments, Settings
- `POST /api/v1/telegram/webhook`
- `POST /api/v1/telegram/bind-codes`
- `POST /api/v1/telegram/outbox/drain`
- `GET /api/v1/audit-logs`
- `POST /api/v1/attachments/presign`
- `POST /api/v1/attachments/complete`
- `GET /api/v1/settings`
- `PATCH /api/v1/settings`

## 8. Queue and Cron Architecture

### Queues
- `notifications`: Telegram, email, in-app fanout.
- `reports`: queued export requests, CSV serializer foundation, and future PDF/Excel generation adapters.
- `reminders`: schedule reminders, outstanding reminders.
- `imports`: resident Excel import processing.
- `backups`: database backup orchestration.
- `outbox`: durable domain event dispatch.

### Cron Jobs
- Weekly schedule reminder: runs daily, sends next-shift reminders.
- Monthly report generation: runs first day of month after midnight RT timezone.
- Outstanding reminder: configurable weekly cadence.
- Database backup: daily, encrypted, retention-managed.
- Session cleanup: hourly expired/revoked session purge.
- Outbox retry: every minute with backoff.

### Retry Policy
- Notification transient failures: exponential backoff, max 5 attempts.
- Report generation: max 3 attempts, failure visible in dashboard.
- Backup failures: alert admin immediately.
- Dead-letter jobs are queryable by Super Admin.

## 9. Telegram Bot Architecture

### Runtime
- Current backend implementation: NestJS `TelegramModule` owns webhook ingestion, command routing, tenant context, and notification delivery adapter.
- Future split option: separate `apps/bot` worker can reuse the same application service boundaries.
- Update mode: webhook in production; local polling can be added as a thin adapter around `TelegramService.handleWebhook`.

### Bot Middleware
1. Parse update.
2. Resolve Telegram account.
3. Resolve linked user/resident and active RT membership.
4. Check command permission.
5. Load minimal conversation state from tenant `Setting` rows.
6. Execute command handler.
7. Persist resulting draft or enqueue backend action.
8. Send confirmation.

### Commands
- `/start`: binding and menu bootstrap.
- `/menu`: role-aware command list.
- `/help`: short usage guide.
- `/saldo`: current cash balance.
- `/rekap`: summary by date range.
- `/input_jimpitan`: multi-step collection input.
- `/jadwal`: officer schedule.
- `/tunggakan`: outstanding list for authorized role.
- `/input_pemasukan`: income draft.
- `/input_pengeluaran`: expense draft and approval trigger.
- `/approval`: pending approval list and decision.
- `/laporan`: report links.

### Conversation State
- Current key: tenant `settings.key = telegram_session:{telegramAccountId}`.
- Future worker option: Redis key `bot:session:{telegramUserId}` if the bot is split out.
- TTL: 30 minutes for unfinished flows.
- State stores command, current step, selected RT, area, house, amount, status, note, draft id.
- Final submit calls backend API and clears state.

## 10. Frontend State Management Architecture

### Server State
- TanStack Query owns API data, cache, invalidation, optimistic updates.
- Query keys always include `rtId` and resource scope.
- Mutations invalidate exact lists and detail queries, not the whole app.

### Client State
- URL search params own filters, pagination, selected tabs, date range.
- React Hook Form owns form draft state.
- Local component state owns open dialogs, popovers, stepper selection.
- Zustand is optional only for auth session shell and cross-page UI state; avoid global domain stores.

### Authentication State
- Access and refresh tokens are stored by Next same-origin auth route handlers in httpOnly secure cookies.
- Browser components call `/api/auth/login`, `/api/auth/session`, `/api/auth/refresh`, and `/api/auth/logout`; backend tokens are never returned to browser JavaScript.
- Same-origin auth route handlers reject cross-site browser POSTs before calling backend Auth APIs.
- Expired access tokens can refresh because dashboard proxy accepts a refresh cookie plus session metadata as an auth hint; refresh failures do not clear cookies in session reads to avoid concurrent refresh races.
- Frontend reads only non-sensitive session metadata from `/api/auth/session`; server layouts read `jimpitan_session_meta` for pre-render route gating.
- Permission map is included in session metadata for UI navigation gating; backend still enforces all permissions.
- Next.js `proxy.ts` guards private dashboard routes and redirects authenticated users away from `/login`.

## 11. Frontend Folder Structure

```text
apps/web/
  src/
    app/
      (public)/
        page.tsx
        reports/
      (auth)/
        login/
      (dashboard)/
        layout.tsx
        dashboard/
          residents/
          jimpitan/
          finance/
          approvals/
          reports/
          settings/
    components/
      ui/
      app-shell/
      data-table/
      forms/
      feedback/
    features/
      auth/
      tenants/
    lib/
      api/
      env/
      navigation/
      permissions/
      query/
      utils/
    proxy.ts
  public/
  Dockerfile
```

## 12. Backend Folder Structure

```text
apps/api/
  src/
    main.ts
    app.module.ts
    common/
      decorators/
      filters/
      guards/
      interceptors/
      pipes/
      errors/
      pagination/
    config/
    modules/
      auth/
      users/
      rbac/
      rt/
      residents/
      schedules/
      collections/
      finance/
      approvals/
      reports/
      notifications/
      telegram/
      audit/
      attachments/
      settings/
      jobs/
      health/
    prisma/
    integrations/
      redis/
      bullmq/
      storage/
      telegram/
      email/
  test/

apps/bot/
  src/
    main.ts
    bot.module.ts
    middleware/
    commands/
    conversations/
    keyboards/
    adapters/
```

## 13. Event Flow Architecture

### Domain Events
- `CollectionSubmitted`
- `CollectionValidated`
- `TransactionCreated`
- `TransactionPosted`
- `ExpenseApprovalRequested`
- `ExpenseApproved`
- `ExpenseRejected`
- `ReportGenerated`
- `OutstandingReminderDue`
- `TelegramAccountBound`
- `RoleChanged`

### Outbox Pattern
- Critical workflows write domain change, audit log, and outbox event in one DB transaction.
- Outbox processor publishes BullMQ jobs.
- Processor marks event processed only after enqueue succeeds.
- Consumers are idempotent by event id.

## 14. Validation Strategy

### Backend
- DTO validation: class-validator or Zod DTO adapter.
- Domain validation: explicit policy classes for finance, approvals, collections.
- Database validation: unique constraints, FK constraints, check constraints for positive amounts.
- Cross-record validation: use Prisma transaction with row-level lock where needed.

### Frontend
- Zod schemas mirror backend request contracts.
- Forms show inline errors and prevent invalid submission.
- Server errors map into form fields when possible.

### Bot
- Every conversation step validates input and allows correction.
- Amount input normalizes Indonesian currency formats.
- Bot never trusts role state from Redis; it rechecks membership before final submit.

## 15. Error Handling Strategy

### Backend Error Classes
- `AuthenticationError`
- `AuthorizationError`
- `ValidationError`
- `TenantScopeError`
- `NotFoundError`
- `ConflictError`
- `FinancePolicyError`
- `ApprovalStateError`
- `ExternalServiceError`

### HTTP Mapping
- 400 validation and malformed input.
- 401 unauthenticated.
- 403 authenticated but forbidden.
- 404 missing resource within tenant scope.
- 409 state conflict, duplicate, stale update.
- 422 domain policy violation.
- 429 rate limited.
- 500 unexpected internal error.
- 503 external dependency unavailable.

### Observability
- Every error response includes `requestId`.
- Internal logs include stack trace, actor, rtId, endpoint, and requestId.
- Sensitive values are redacted.

## 16. Audit Log Strategy

### Must Audit
- Login success/failure.
- Logout and refresh token revocation.
- Role and permission changes.
- Resident create/update/delete/import.
- Schedule assignment changes.
- Collection submit/validate/reject.
- Transaction create/update/delete/validate/post/void.
- Approval request/approve/reject.
- Settings changes.
- Attachment upload completion.

### Audit Rules
- Audit logs are append-only.
- Audit writes happen inside the same transaction as the sensitive mutation.
- Before/after JSON is redacted for secrets and tokens.
- Public users cannot query audit logs.
- Super Admin can query cross-RT audit with filters.

## 17. Notification Architecture

### Channels
- In-app notification: persisted in `notifications`.
- Telegram: queue job sends bot message.
- Email: optional adapter behind the same interface.

### Fanout
- Use `NotificationRequested` event.
- Notification service resolves recipients by role, officer assignment, resident binding, or direct user.
- Each recipient-channel pair creates one notification row.
- Each notification row creates a `NOTIFICATION_DELIVERY_REQUESTED` outbox event in the same database transaction.
- Delivery jobs update status to `SENT`, `FAILED`, or `CANCELLED`.
- Read state uses `read_at`; delivery status is not mutated to `READ`.
- Idempotency and dedupe replays must match the original request fingerprint; mismatch attempts are audited and rejected.
- Retry is status-conditional and replay-safe; already-pending retries do not create another outbox row.
- Final delivery states are protected from unsafe transitions.
- Telegram adapter is implemented through `TelegramService.processTelegramOutbox` with tenant, aggregate, channel, account, status, and active binding checks; email remains a port/no-op hook until provider integration is implemented.

### Notification Types
- `COLLECTION_ASSIGNED`
- `COLLECTION_SUBMITTED`
- `COLLECTION_VALIDATED`
- `EXPENSE_APPROVAL_REQUESTED`
- `EXPENSE_APPROVED`
- `EXPENSE_REJECTED`
- `TRANSACTION_POSTED`
- `MONTHLY_REPORT_READY`
- `SYSTEM_ALERT`

### Current Backend Status
- Implemented: tenant-scoped in-app notifications, outbox rows, recipient validation, delivery status lifecycle, retry/cancel, idempotency, RBAC, audit logs, and Telegram provider delivery.
- Integrated hooks: approvals, jimpitan collection lifecycle, finance transaction posted notifications, and Telegram outbox dispatch.
- Excluded: email provider calls and frontend UI. Reporting engine and public transparency APIs are implemented separately in the Reports module.

## 18. File Upload Architecture

### Flow
1. Client requests `POST /attachments/presign` with owner type, file name, mime type, size.
2. API validates permission, size, mime type, owner existence.
3. API returns presigned upload URL and temporary object key.
4. Client uploads directly to S3/R2/MinIO.
5. Client calls `POST /attachments/complete`.
6. API verifies object metadata and creates attachment row.
7. Optional scan job marks file usable.

### Storage Rules
- Object key includes `rtId`, owner type, date, random id.
- Max receipt size default: 10 MB.
- Allowed receipt types: PDF, PNG, JPG, WEBP.
- Public reports can use signed download URLs with short TTL.
- Private receipts require authenticated presigned download.

## 19. Environment Variable Structure

```env
NODE_ENV=
APP_ENV=
APP_URL=
API_URL=

DATABASE_URL=
DIRECT_DATABASE_URL=
REDIS_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL_SECONDS=
JWT_REFRESH_TTL_SECONDS=
BCRYPT_ROUNDS=

BOT_TOKEN=
BOT_WEBHOOK_SECRET=
BOT_WEBHOOK_URL=

S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_FORCE_PATH_STYLE=

RATE_LIMIT_GLOBAL_PER_MINUTE=
RATE_LIMIT_AUTH_PER_MINUTE=
EXPENSE_APPROVAL_THRESHOLD_DEFAULT=
PUBLIC_REPORT_CACHE_TTL_SECONDS=

BACKUP_BUCKET=
BACKUP_ENCRYPTION_KEY=
BACKUP_RETENTION_DAYS=

SENTRY_DSN=
LOG_LEVEL=
```

## 20. Docker Architecture

### Services
- `frontend`: Next.js web app.
- `backend`: NestJS API.
- `bot`: Telegram bot worker.
- `worker`: BullMQ worker for reports, reminders, backups, notifications.
- `postgres`: PostgreSQL.
- `redis`: Redis.
- `minio`: local S3-compatible storage.
- `nginx`: TLS termination, reverse proxy, static compression.

### Network
- Public: `nginx`.
- Internal: `frontend`, `backend`, `bot`, `worker`, `postgres`, `redis`, `minio`.
- Backend and worker share same image with different command.

## 21. Deployment Architecture

### Initial Production
- Single VPS or small VM cluster with Docker Compose.
- Nginx terminates TLS and routes:
  - `/` to frontend.
  - `/api` to backend.
  - `/api/v1/telegram/webhook` to backend or bot webhook service.
- PostgreSQL volume with automated backup to external object storage.
- Redis persistence enabled for queue durability.

### Growth Path
- Move PostgreSQL to managed database.
- Move object storage to R2 or AWS S3.
- Split API, worker, and bot replicas.
- Add read replicas for heavy report reads.
- Move to Kubernetes/ECS only after operational need exists.

## 22. CI/CD Planning

### Pipeline
1. Install dependencies.
2. Typecheck all packages.
3. Lint all packages.
4. Run unit tests.
5. Run backend integration tests with PostgreSQL and Redis.
6. Generate Prisma client.
7. Validate Prisma migrations.
8. Build frontend, backend, bot, worker images.
9. Run container smoke tests.
10. Push images.
11. Deploy staging.
12. Run migration against staging.
13. Run smoke tests.
14. Manual approval for production.
15. Deploy production.
16. Run migrations with backup pre-check.
17. Post-deploy health checks.

### Branch Rules
- Pull requests require typecheck, lint, tests, build.
- Production deploy requires tagged release or protected branch.
- Migrations require review.

## 23. Multi-RT Scalability Planning

### Data Isolation
- Every tenant-owned table includes `rt_id`.
- All repositories require tenant context.
- Prisma middleware or repository base class rejects tenant queries without `rtId`.
- Optional future PostgreSQL row-level security can enforce tenant scope.

### Performance
- Composite indexes start with `rt_id`.
- Public report summary can be cached by `rtCode` and month.
- Heavy exports run async.
- Dashboard widgets fetch aggregated endpoints, not raw full tables.

### Feature Flags
- Settings table stores per-RT options:
  - approval threshold
  - default jimpitan amount
  - public report visibility
  - reminder schedules
  - notification channels

## 24. Security Planning

### Application Security
- Helmet enabled.
- CORS allowlist.
- CSRF protection for cookie refresh endpoint.
- JWT access tokens short-lived.
- Refresh token rotation with hashed storage.
- bcrypt password hashing.
- RBAC and tenant guard on private endpoints.
- Input validation on every request.
- File MIME and size validation.
- Secret redaction in logs.
- OpenAPI protected in production.

### Data Security
- Private resident data hidden from public endpoints.
- Telegram IDs not exposed publicly.
- Internal notes private.
- Audit before/after redacts secrets and tokens.
- Backups encrypted.

### Finance Security
- Posted transactions cannot be edited directly; use adjustment or void workflow.
- Expense approval threshold enforced server-side.
- Ledger writes are transactionally consistent and idempotent.
- Audit log required for all finance state changes.

## 25. Backup Strategy

### Database
- Daily logical backup with `pg_dump`.
- Weekly full backup retained longer.
- Encrypt before upload.
- Store in external object storage.
- Retention default: 30 daily, 12 monthly.
- Monthly restore drill in staging.

### Object Storage
- Versioning enabled in production bucket where supported.
- Lifecycle retention aligned with financial record policy.
- Attachment metadata in DB is backed up with PostgreSQL.

### Redis
- Redis is not source of truth.
- Queue jobs are recoverable from outbox events for critical workflows.

## 26. Rate Limiting Strategy

### Limits
- Global API: configurable per IP per minute.
- Auth login: stricter per IP and per identifier.
- Refresh: per session and per IP.
- Public reports: cache + per IP.
- Telegram webhook: verify secret and rate-limit by Telegram user id.
- Upload presign: per user and per RT.

### Abuse Handling
- Failed login counter locks account after threshold.
- Suspicious repeated approval attempts are audited.
- Bot command flood returns quiet cooldown response.

## 27. Cash Ledger Consistency Strategy

### Posting Rule
- Only `POSTED` transactions affect `cash_ledgers`.
- Each posted transaction has exactly one ledger row.
- Ledger row has unique `transaction_id`.
- Collection validation creates an income transaction from collection total.
- Expenses above threshold enter `PENDING_APPROVAL` before posting.

### Transactional Posting
1. Start DB transaction.
2. Lock RT ledger stream with advisory lock or `settings` balance row lock.
3. Verify transaction state and policy.
4. Compute current balance from last ledger row.
5. Validate sufficient balance for expense where negative cash is disabled.
6. Insert ledger row with `balance_after`.
7. Mark transaction `POSTED`.
8. Write audit log.
9. Write outbox event.
10. Commit.

### Reconciliation
- Nightly job recomputes ledger sequence per RT and alerts on mismatch.
- No silent auto-fix in production.
- Adjustments require explicit audited transaction.

DB-heavy justification: ledger posting uses one short tenant-scoped transaction plus a ledger-stream lock to prevent race conditions without locking unrelated RT data.

## 28. Implementation Phases

### Phase 0: Repository and Architecture Baseline
- Initialize monorepo.
- Add map files and architecture docs.
- Add lint, format, TypeScript, test, commit hooks.
- Add Docker Compose skeleton for Postgres, Redis, MinIO.

### Phase 1: Backend Foundation
- Create NestJS API skeleton.
- Add config validation.
- Add Prisma setup and initial migration.
- Add global validation, error filter, request id, logging.
- Add health endpoints.

### Phase 2: Auth, Tenancy, RBAC
- Implement users, sessions, JWT refresh rotation.
- Implement RT membership.
- Seed roles and permissions.
- Add tenant guard and permission guard.
- Add audit logging for auth and role changes.

### Phase 3: Resident, House, Area Management
- Implement areas, houses, residents CRUD.
- Add import/export job architecture.
- Add Telegram account binding records.
- Add search, pagination, soft delete.

### Phase 4: Jimpitan Scheduling and Collection
- Implement schedule generation.
- Implement officer route workflow.
- Implement collection drafts, items, submit, validate, reject.
- Create outstanding tracking queries.
- Enqueue validation notifications.

### Phase 5: Finance and Ledger
- Current backend status: Finance and Ledger foundation logic is implemented for cash accounts, categories, income/expense drafts, validation/rejection/void/post lifecycle, dedicated source collection posting, append-only ledger entries, strict idempotency replay guards, balances, RBAC, and audit logs.
- Cash-flow reporting queries are implemented in the Reports module from immutable ledger data.

### Phase 6: Expense Approval
- Current backend status: Expense Approval workflow is implemented for threshold policy, request/decision lifecycle, cancellation, approver queues, finance posting gate, notification hooks, RBAC, tenant isolation, and audit logs.
- Email provider delivery, dashboards, analytics, and payment gateway integrations remain excluded; reports are implemented in the Reports module and Telegram approval commands reuse the approval service boundary.

### Phase 7: Notification and Queue Workers
- Current backend status: Notification workflow is implemented for in-app notification rows, outbox fanout, recipient validation, retry/cancel, idempotency, RBAC, tenant isolation, audit logs, Telegram hook interfaces, and Telegram outbox delivery through the Telegram module.
- Add BullMQ queues.
- Add outbox processor.
- Add email provider delivery adapter.
- Add reminder and cleanup cron jobs.

### Phase 8: Telegram Bot
- Current backend status: Telegram bot webhook, bind-code redaction, binding, role-aware menu, command router, state handling, Jimpitan input, finance quick commands, approval actions, notification delivery adapter, RBAC, tenant isolation, and audit logs are implemented.
- Optional future work: split to a dedicated bot worker and replace settings-backed state with Redis if operational scale requires it.

### Phase 9: Frontend Foundation
- Current frontend status: Next.js App Router shell, Tailwind tokens, shadcn-compatible primitives, TanStack Query provider, React Hook Form/Zod login shell, same-origin Auth API route handlers, same-origin auth POST checks, httpOnly token cookies, session refresh/logout flow with refresh-race protection, public/private route groups, Next.js proxy guard, tenant context, permission-aware navigation, responsive sidebar/mobile sheet, loading/error/empty states, notification UI foundation, API client, query key strategy, Docker readiness, and frontend architecture notes are implemented.
- Business feature pages remain placeholders only.

### Phase 10: Dashboard Modules
- Build overview widgets.
- Build residents, houses, collections, finance, approvals, reports, audit, settings pages.
- Add mobile-first officer collection workflow.
- Add loading, empty, error, and optimistic states.

### Phase 11: Reports and Transparency
- Current backend status: ledger-derived private reports, public-safe transparency endpoints, date-range validation, export request foundation, CSV serializer foundation, and PDF/Excel provider interfaces are implemented.
- Future work: add chart-specific frontend views, actual PDF/Excel generation providers, queued export worker, and public contact pages.

### Phase 12: Uploads, Backups, Hardening
- Implement presigned uploads.
- Add receipt attachment workflows.
- Add encrypted backups.
- Add rate limiting, security headers, CSRF, CORS.
- Add monitoring and alerting.

### Phase 13: Production Release
- Add CI/CD pipeline.
- Add staging deploy.
- Run migration checks and smoke tests.
- Run backup restore drill.
- Perform security review.
- Deploy production.
