-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('ANNOUNCEMENT', 'ACTIVITY', 'ARTICLE', 'GALLERY');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'LOVE', 'SUPPORT');

-- AlterTable
ALTER TABLE "announcements"
    ADD COLUMN "type" "ContentType" NOT NULL DEFAULT 'ANNOUNCEMENT',
    ADD COLUMN "slug" VARCHAR(200),
    ADD COLUMN "excerpt" VARCHAR(300),
    ADD COLUMN "event_start_at" TIMESTAMPTZ(6),
    ADD COLUMN "event_end_at" TIMESTAMPTZ(6),
    ADD COLUMN "location" VARCHAR(200),
    ADD COLUMN "reaction_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "view_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "post_reactions" (
    "id" UUID NOT NULL,
    "rt_id" UUID NOT NULL,
    "announcement_id" UUID NOT NULL,
    "reaction_type" "ReactionType" NOT NULL DEFAULT 'LIKE',
    "visitor_hash" VARCHAR(64) NOT NULL,
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "announcements_rt_id_slug_key" ON "announcements"("rt_id", "slug");

-- CreateIndex
CREATE INDEX "announcements_rt_id_type_status_published_at_idx" ON "announcements"("rt_id", "type", "status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "post_reactions_announcement_id_visitor_hash_key" ON "post_reactions"("announcement_id", "visitor_hash");

-- CreateIndex
CREATE INDEX "post_reactions_rt_id_announcement_id_idx" ON "post_reactions"("rt_id", "announcement_id");

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_rt_id_fkey" FOREIGN KEY ("rt_id") REFERENCES "rts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
