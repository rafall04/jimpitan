/**
 * Purpose: Application-layer command contracts for content authoring and public interaction.
 * Caller: ContentService and controllers.
 * Deps: Prisma content enums.
 * MainFuncs: Defines create/update/list/reaction command shapes and request metadata.
 * SideEffects: None.
 */
import type { AnnouncementStatus, AnnouncementVisibility, ContentType, ReactionType } from '@prisma/client';

export interface ContentRequestMeta {
  correlationId?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface CreatePostCommand {
  type: ContentType;
  title: string;
  body: string;
  excerpt?: string;
  visibility?: AnnouncementVisibility;
  eventStartAt?: string;
  eventEndAt?: string;
  location?: string;
  publish?: boolean;
}

export interface UpdatePostCommand {
  title?: string;
  body?: string;
  excerpt?: string | null;
  visibility?: AnnouncementVisibility;
  eventStartAt?: string | null;
  eventEndAt?: string | null;
  location?: string | null;
}

export interface ContentListQuery {
  page: number;
  limit: number;
  type?: ContentType;
  status?: AnnouncementStatus;
  search?: string;
}

export interface PublicContentListQuery {
  page: number;
  limit: number;
  type?: ContentType;
  search?: string;
}

export interface ReactionInput {
  reactionType: ReactionType;
  visitorHash: string;
  ipHash?: string;
}
