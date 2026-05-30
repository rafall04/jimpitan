-- Purpose: Initial PostgreSQL schema migration for JIMPITAN.
-- Caller: Prisma migrate deploy during fresh production database setup.
-- Deps: prisma/schema.prisma current datasource and model definitions.
-- MainFuncs: Creates enums, tables, constraints, unique keys, foreign keys, and indexes matching the current Prisma schema.
-- SideEffects: Creates database schema objects in the target PostgreSQL database.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "HouseStatus" AS ENUM ('OCCUPIED', 'EMPTY', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ResidentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MOVED');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CollectionStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CollectionMode" AS ENUM ('PER_HOUSE', 'BULK_TOTAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "CollectionItemStatus" AS ENUM ('PAID', 'UNPAID', 'HOUSE_EMPTY', 'LEFT_WITH_NEIGHBOR', 'TITIP_TETANGGA', 'OVERDUE', 'MENUNGGAK', 'DISPENSATION');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PENDING_VALIDATION', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('INCREASE', 'DECREASE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'TELEGRAM', 'EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'CANCELLED', 'READ');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'SCANNED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "AttachmentOwnerType" AS ENUM ('TRANSACTION', 'REPORT_EXPORT', 'RESIDENT_IMPORT', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM', 'BOT');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReportExportFormat" AS ENUM ('PDF', 'EXCEL', 'CSV');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AnnouncementVisibility" AS ENUM ('PUBLIC', 'MEMBERS');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TelegramBindingStatus" AS ENUM ('PENDING', 'VERIFIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TelegramUpdateStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "rts" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "address" TEXT,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(160),
    "phone" VARCHAR(32),
    "password_hash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" INET,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_by_id" UUID,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "rt_id" UUID,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "module" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "rt_memberships" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rt_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "membership_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("membership_id","role_id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "houses" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "house_number" VARCHAR(40) NOT NULL,
    "address_note" TEXT,
    "status" "HouseStatus" NOT NULL DEFAULT 'OCCUPIED',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "houses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residents" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(32),
    "status" "ResidentStatus" NOT NULL DEFAULT 'ACTIVE',
    "default_jimpitan_amount" DECIMAL(14,2) NOT NULL DEFAULT 2000,
    "notes" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "residents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_accounts" (
    "id" UUID NOT NULL,
    "telegram_user_id" VARCHAR(64) NOT NULL,
    "username" VARCHAR(120),
    "display_name" VARCHAR(160),
    "linked_user_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "telegram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_bindings" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "telegram_account_id" UUID NOT NULL,
    "user_id" UUID,
    "membership_id" UUID,
    "resident_id" UUID,
    "status" "TelegramBindingStatus" NOT NULL DEFAULT 'PENDING',
    "bind_token_hash" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "telegram_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_updates" (
    "id" UUID NOT NULL,
    "rt_id" UUID,
    "telegram_account_id" UUID,
    "telegram_update_id" BIGINT NOT NULL,
    "update_type" VARCHAR(80) NOT NULL,
    "status" "TelegramUpdateStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "error_message" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "telegram_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL DEFAULT 'main',
    "name" VARCHAR(120) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'IDR',
    "current_balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jimpitan_schedules" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "area_id" UUID,
    "officer_membership_id" UUID NOT NULL,
    "schedule_date" DATE NOT NULL,
    "schedule_type" "ScheduleType" NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "cancelled_by_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jimpitan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jimpitan_collections" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "schedule_id" UUID,
    "officer_membership_id" UUID NOT NULL,
    "collection_date" DATE NOT NULL,
    "collection_mode" "CollectionMode" NOT NULL DEFAULT 'PER_HOUSE',
    "status" "CollectionStatus" NOT NULL DEFAULT 'DRAFT',
    "submit_request_id" VARCHAR(120),
    "submitted_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ(6),
    "rejected_by_id" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "cancelled_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "validation_note" TEXT,
    "rejection_reason" TEXT,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jimpitan_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "house_id" UUID NOT NULL,
    "resident_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "CollectionItemStatus" NOT NULL,
    "note" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" UUID NOT NULL,
    "rt_id" UUID,
    "type" "TransactionType" NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "cash_account_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "source_collection_id" UUID,
    "reference_number" VARCHAR(80),
    "idempotency_key" VARCHAR(120),
    "external_ref" VARCHAR(120),
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ(6),
    "validation_note" TEXT,
    "rejected_by_id" UUID,
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "posted_by_id" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "voided_by_id" UUID,
    "voided_at" TIMESTAMPTZ(6),
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_ledgers" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "cash_account_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "ledger_sequence" INTEGER NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balance_before" DECIMAL(14,2) NOT NULL,
    "balance_after" DECIMAL(14,2) NOT NULL,
    "ledger_date" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_approvals" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "approver_membership_id" UUID NOT NULL,
    "decision_by_id" UUID,
    "idempotency_key" VARCHAR(120),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "decision_note" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expense_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "recipient_user_id" UUID,
    "recipient_resident_id" UUID,
    "telegram_account_id" UUID,
    "idempotency_key" VARCHAR(120),
    "dedupe_key" VARCHAR(160),
    "channel" "NotificationChannel" NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "failure_reason" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "transaction_id" UUID,
    "report_export_id" UUID,
    "resident_import_id" UUID,
    "announcement_id" UUID,
    "owner_type" "AttachmentOwnerType" NOT NULL,
    "owner_id" UUID NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "bucket" VARCHAR(120) NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum" VARCHAR(128),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "uploaded_by_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "rt_id" UUID,
    "actor_user_id" UUID,
    "actor_type" "AuditActorType" NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID,
    "request_id" VARCHAR(120),
    "correlation_id" VARCHAR(120),
    "before_data" JSONB,
    "after_data" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "AnnouncementVisibility" NOT NULL DEFAULT 'PUBLIC',
    "published_at" TIMESTAMPTZ(6),
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,
    "deleted_by_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_exports" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "report_type" VARCHAR(80) NOT NULL,
    "format" "ReportExportFormat" NOT NULL,
    "status" "ReportExportStatus" NOT NULL DEFAULT 'QUEUED',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "file_name" VARCHAR(255),
    "object_key" TEXT,
    "error_message" TEXT,
    "idempotency_key" VARCHAR(120),
    "expires_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident_imports" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'QUEUED',
    "file_name" VARCHAR(255) NOT NULL,
    "idempotency_key" VARCHAR(120),
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "error_summary" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resident_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "rt_id" UUID,
    "event_type" VARCHAR(120) NOT NULL,
    "aggregate_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "dedupe_key" VARCHAR(160),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rts_code_key" ON "rts"("code");

-- CreateIndex
CREATE INDEX "rts_is_active_deleted_at_idx" ON "rts"("is_active", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_status_deleted_at_idx" ON "users"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "roles_key_idx" ON "roles"("key");

-- CreateIndex
CREATE INDEX "roles_rt_id_deleted_at_idx" ON "roles"("rt_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_rt_id_key_key" ON "roles"("rt_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "rt_memberships_user_id_status_idx" ON "rt_memberships"("user_id", "status");

-- CreateIndex
CREATE INDEX "rt_memberships_rt_id_status_idx" ON "rt_memberships"("rt_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "rt_memberships_rt_id_user_id_key" ON "rt_memberships"("rt_id", "user_id");

-- CreateIndex
CREATE INDEX "areas_rt_id_is_active_sort_order_idx" ON "areas"("rt_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "areas_rt_id_deleted_at_idx" ON "areas"("rt_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "areas_rt_id_code_key" ON "areas"("rt_id", "code");

-- CreateIndex
CREATE INDEX "houses_rt_id_area_id_status_idx" ON "houses"("rt_id", "area_id", "status");

-- CreateIndex
CREATE INDEX "houses_rt_id_deleted_at_idx" ON "houses"("rt_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "houses_rt_id_house_number_key" ON "houses"("rt_id", "house_number");

-- CreateIndex
CREATE INDEX "residents_rt_id_house_id_status_idx" ON "residents"("rt_id", "house_id", "status");

-- CreateIndex
CREATE INDEX "residents_rt_id_status_deleted_at_idx" ON "residents"("rt_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "residents_rt_id_full_name_idx" ON "residents"("rt_id", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_telegram_user_id_key" ON "telegram_accounts"("telegram_user_id");

-- CreateIndex
CREATE INDEX "telegram_accounts_linked_user_id_idx" ON "telegram_accounts"("linked_user_id");

-- CreateIndex
CREATE INDEX "telegram_bindings_telegram_account_id_status_idx" ON "telegram_bindings"("telegram_account_id", "status");

-- CreateIndex
CREATE INDEX "telegram_bindings_rt_id_status_idx" ON "telegram_bindings"("rt_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bindings_rt_id_telegram_account_id_key" ON "telegram_bindings"("rt_id", "telegram_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bindings_rt_id_membership_id_key" ON "telegram_bindings"("rt_id", "membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_bindings_rt_id_resident_id_key" ON "telegram_bindings"("rt_id", "resident_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_updates_telegram_update_id_key" ON "telegram_updates"("telegram_update_id");

-- CreateIndex
CREATE INDEX "telegram_updates_rt_id_status_created_at_idx" ON "telegram_updates"("rt_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "telegram_updates_telegram_account_id_created_at_idx" ON "telegram_updates"("telegram_account_id", "created_at");

-- CreateIndex
CREATE INDEX "cash_accounts_rt_id_is_active_idx" ON "cash_accounts"("rt_id", "is_active");

-- CreateIndex
CREATE INDEX "cash_accounts_rt_id_deleted_at_idx" ON "cash_accounts"("rt_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "cash_accounts_rt_id_key_key" ON "cash_accounts"("rt_id", "key");

-- CreateIndex
CREATE INDEX "jimpitan_schedules_rt_id_schedule_date_status_idx" ON "jimpitan_schedules"("rt_id", "schedule_date", "status");

-- CreateIndex
CREATE INDEX "jimpitan_schedules_rt_id_officer_membership_id_schedule_dat_idx" ON "jimpitan_schedules"("rt_id", "officer_membership_id", "schedule_date");

-- CreateIndex
CREATE UNIQUE INDEX "jimpitan_schedules_rt_id_officer_membership_id_schedule_dat_key" ON "jimpitan_schedules"("rt_id", "officer_membership_id", "schedule_date", "area_id");

-- CreateIndex
CREATE INDEX "jimpitan_collections_rt_id_collection_date_status_idx" ON "jimpitan_collections"("rt_id", "collection_date", "status");

-- CreateIndex
CREATE INDEX "jimpitan_collections_rt_id_collection_mode_status_idx" ON "jimpitan_collections"("rt_id", "collection_mode", "status");

-- CreateIndex
CREATE INDEX "jimpitan_collections_rt_id_officer_membership_id_collection_idx" ON "jimpitan_collections"("rt_id", "officer_membership_id", "collection_date");

-- CreateIndex
CREATE INDEX "jimpitan_collections_rt_id_schedule_id_idx" ON "jimpitan_collections"("rt_id", "schedule_id");

-- CreateIndex
CREATE UNIQUE INDEX "jimpitan_collections_rt_id_submit_request_id_key" ON "jimpitan_collections"("rt_id", "submit_request_id");

-- CreateIndex
CREATE INDEX "collection_items_rt_id_house_id_status_idx" ON "collection_items"("rt_id", "house_id", "status");

-- CreateIndex
CREATE INDEX "collection_items_rt_id_resident_id_idx" ON "collection_items"("rt_id", "resident_id");

-- CreateIndex
CREATE INDEX "collection_items_rt_id_status_created_at_idx" ON "collection_items"("rt_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "collection_items_collection_id_house_id_key" ON "collection_items"("collection_id", "house_id");

-- CreateIndex
CREATE INDEX "transaction_categories_type_is_active_idx" ON "transaction_categories"("type", "is_active");

-- CreateIndex
CREATE INDEX "transaction_categories_rt_id_deleted_at_idx" ON "transaction_categories"("rt_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_categories_rt_id_key_type_key" ON "transaction_categories"("rt_id", "key", "type");

-- CreateIndex
CREATE INDEX "transactions_rt_id_transaction_date_type_idx" ON "transactions"("rt_id", "transaction_date", "type");

-- CreateIndex
CREATE INDEX "transactions_rt_id_status_idx" ON "transactions"("rt_id", "status");

-- CreateIndex
CREATE INDEX "transactions_rt_id_category_id_transaction_date_idx" ON "transactions"("rt_id", "category_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_rt_id_cash_account_id_transaction_date_idx" ON "transactions"("rt_id", "cash_account_id", "transaction_date");

-- CreateIndex
CREATE INDEX "transactions_rt_id_source_collection_id_idx" ON "transactions"("rt_id", "source_collection_id");

-- CreateIndex
CREATE INDEX "transactions_rt_id_deleted_at_idx" ON "transactions"("rt_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_rt_id_reference_number_key" ON "transactions"("rt_id", "reference_number");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_rt_id_idempotency_key_key" ON "transactions"("rt_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_rt_id_external_ref_key" ON "transactions"("rt_id", "external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_source_collection_id_key" ON "transactions"("source_collection_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_ledgers_transaction_id_key" ON "cash_ledgers"("transaction_id");

-- CreateIndex
CREATE INDEX "cash_ledgers_rt_id_cash_account_id_ledger_date_id_idx" ON "cash_ledgers"("rt_id", "cash_account_id", "ledger_date", "id");

-- CreateIndex
CREATE INDEX "cash_ledgers_rt_id_ledger_date_idx" ON "cash_ledgers"("rt_id", "ledger_date");

-- CreateIndex
CREATE UNIQUE INDEX "cash_ledgers_cash_account_id_ledger_sequence_key" ON "cash_ledgers"("cash_account_id", "ledger_sequence");

-- CreateIndex
CREATE INDEX "expense_approvals_rt_id_status_created_at_idx" ON "expense_approvals"("rt_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "expense_approvals_approver_membership_id_status_idx" ON "expense_approvals"("approver_membership_id", "status");

-- CreateIndex
CREATE INDEX "expense_approvals_rt_id_transaction_id_idx" ON "expense_approvals"("rt_id", "transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_approvals_transaction_id_approver_membership_id_key" ON "expense_approvals"("transaction_id", "approver_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_approvals_rt_id_idempotency_key_key" ON "expense_approvals"("rt_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notifications_rt_id_recipient_user_id_status_idx" ON "notifications"("rt_id", "recipient_user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_rt_id_recipient_resident_id_status_idx" ON "notifications"("rt_id", "recipient_resident_id", "status");

-- CreateIndex
CREATE INDEX "notifications_rt_id_channel_status_idx" ON "notifications"("rt_id", "channel", "status");

-- CreateIndex
CREATE INDEX "notifications_rt_id_type_created_at_idx" ON "notifications"("rt_id", "type", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_rt_id_idempotency_key_key" ON "notifications"("rt_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_rt_id_dedupe_key_key" ON "notifications"("rt_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "attachments_rt_id_owner_type_owner_id_idx" ON "attachments"("rt_id", "owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "attachments_rt_id_transaction_id_idx" ON "attachments"("rt_id", "transaction_id");

-- CreateIndex
CREATE INDEX "attachments_rt_id_report_export_id_idx" ON "attachments"("rt_id", "report_export_id");

-- CreateIndex
CREATE INDEX "attachments_rt_id_resident_import_id_idx" ON "attachments"("rt_id", "resident_import_id");

-- CreateIndex
CREATE INDEX "attachments_rt_id_announcement_id_idx" ON "attachments"("rt_id", "announcement_id");

-- CreateIndex
CREATE INDEX "attachments_rt_id_status_idx" ON "attachments"("rt_id", "status");

-- CreateIndex
CREATE INDEX "attachments_rt_id_deleted_at_idx" ON "attachments"("rt_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_rt_id_object_key_key" ON "attachments"("rt_id", "object_key");

-- CreateIndex
CREATE INDEX "audit_logs_rt_id_entity_type_entity_id_idx" ON "audit_logs"("rt_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_rt_id_actor_user_id_created_at_idx" ON "audit_logs"("rt_id", "actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "audit_logs_correlation_id_idx" ON "audit_logs"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "settings_rt_id_key_key" ON "settings"("rt_id", "key");

-- CreateIndex
CREATE INDEX "announcements_rt_id_status_visibility_published_at_idx" ON "announcements"("rt_id", "status", "visibility", "published_at");

-- CreateIndex
CREATE INDEX "announcements_rt_id_deleted_at_idx" ON "announcements"("rt_id", "deleted_at");

-- CreateIndex
CREATE INDEX "report_exports_rt_id_status_created_at_idx" ON "report_exports"("rt_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "report_exports_rt_id_report_type_created_at_idx" ON "report_exports"("rt_id", "report_type", "created_at");

-- CreateIndex
CREATE INDEX "report_exports_status_format_created_at_idx" ON "report_exports"("status", "format", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_exports_rt_id_idempotency_key_key" ON "report_exports"("rt_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "resident_imports_rt_id_status_created_at_idx" ON "resident_imports"("rt_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "resident_imports_rt_id_idempotency_key_key" ON "resident_imports"("rt_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "outbox_events_rt_id_event_type_created_at_idx" ON "outbox_events"("rt_id", "event_type", "created_at");

-- CreateIndex
CREATE INDEX "outbox_events_aggregate_type_aggregate_id_idx" ON "outbox_events"("aggregate_type", "aggregate_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_dedupe_key_key" ON "outbox_events"("dedupe_key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rt_memberships" ADD CONSTRAINT "rt_memberships_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rt_memberships" ADD CONSTRAINT "rt_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "rt_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houses" ADD CONSTRAINT "houses_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "houses" ADD CONSTRAINT "houses_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residents" ADD CONSTRAINT "residents_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bindings" ADD CONSTRAINT "telegram_bindings_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bindings" ADD CONSTRAINT "telegram_bindings_telegram_account_id_fkey" FOREIGN KEY ("telegram_account_id") REFERENCES "telegram_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bindings" ADD CONSTRAINT "telegram_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bindings" ADD CONSTRAINT "telegram_bindings_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "rt_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_bindings" ADD CONSTRAINT "telegram_bindings_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_telegram_account_id_fkey" FOREIGN KEY ("telegram_account_id") REFERENCES "telegram_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_accounts" ADD CONSTRAINT "cash_accounts_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_schedules" ADD CONSTRAINT "jimpitan_schedules_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_schedules" ADD CONSTRAINT "jimpitan_schedules_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_schedules" ADD CONSTRAINT "jimpitan_schedules_officer_membership_id_fkey" FOREIGN KEY ("officer_membership_id") REFERENCES "rt_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_schedules" ADD CONSTRAINT "jimpitan_schedules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_collections" ADD CONSTRAINT "jimpitan_collections_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_collections" ADD CONSTRAINT "jimpitan_collections_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "jimpitan_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_collections" ADD CONSTRAINT "jimpitan_collections_officer_membership_id_fkey" FOREIGN KEY ("officer_membership_id") REFERENCES "rt_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_collections" ADD CONSTRAINT "jimpitan_collections_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jimpitan_collections" ADD CONSTRAINT "jimpitan_collections_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "jimpitan_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_resident_id_fkey" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_categories" ADD CONSTRAINT "transaction_categories_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_source_collection_id_fkey" FOREIGN KEY ("source_collection_id") REFERENCES "jimpitan_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_rejected_by_id_fkey" FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_posted_by_id_fkey" FOREIGN KEY ("posted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledgers" ADD CONSTRAINT "cash_ledgers_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledgers" ADD CONSTRAINT "cash_ledgers_cash_account_id_fkey" FOREIGN KEY ("cash_account_id") REFERENCES "cash_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_ledgers" ADD CONSTRAINT "cash_ledgers_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approvals" ADD CONSTRAINT "expense_approvals_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approvals" ADD CONSTRAINT "expense_approvals_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approvals" ADD CONSTRAINT "expense_approvals_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approvals" ADD CONSTRAINT "expense_approvals_decision_by_id_fkey" FOREIGN KEY ("decision_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approvals" ADD CONSTRAINT "expense_approvals_approver_membership_id_fkey" FOREIGN KEY ("approver_membership_id") REFERENCES "rt_memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_resident_id_fkey" FOREIGN KEY ("recipient_resident_id") REFERENCES "residents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_telegram_account_id_fkey" FOREIGN KEY ("telegram_account_id") REFERENCES "telegram_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_report_export_id_fkey" FOREIGN KEY ("report_export_id") REFERENCES "report_exports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_resident_import_id_fkey" FOREIGN KEY ("resident_import_id") REFERENCES "resident_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_exports" ADD CONSTRAINT "report_exports_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_imports" ADD CONSTRAINT "resident_imports_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_imports" ADD CONSTRAINT "resident_imports_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
