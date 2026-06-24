/**
 * Purpose: Content domain types shared across the content module boundary.
 * Caller: ContentService, content repository port + adapter, controllers.
 * Deps: Prisma content enums, attachment image reference type.
 * MainFuncs: Defines authoring records, list rows, and public-safe content shapes.
 * SideEffects: None.
 */
import type { AnnouncementStatus, AnnouncementVisibility, ContentType, ReactionType } from '@prisma/client';
import type { AttachmentImageRef } from '../../attachments/domain/attachment.types';

export interface ContentAuthor {
  id: string;
  fullName: string;
}

export interface ContentListRow {
  id: string;
  type: ContentType;
  status: AnnouncementStatus;
  visibility: AnnouncementVisibility;
  title: string;
  slug: string | null;
  excerpt: string | null;
  eventStartAt: Date | null;
  location: string | null;
  reactionCount: number;
  viewCount: number;
  publishedAt: Date | null;
  coverImage: AttachmentImageRef | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentPostRecord {
  id: string;
  type: ContentType;
  status: AnnouncementStatus;
  visibility: AnnouncementVisibility;
  title: string;
  slug: string | null;
  excerpt: string | null;
  body: string;
  eventStartAt: Date | null;
  eventEndAt: Date | null;
  location: string | null;
  reactionCount: number;
  viewCount: number;
  publishedAt: Date | null;
  coverImage: AttachmentImageRef | null;
  images: AttachmentImageRef[];
  createdBy: ContentAuthor | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicContentItem {
  type: ContentType;
  typePath: string;
  title: string;
  slug: string;
  excerpt: string | null;
  eventStartAt: Date | null;
  eventEndAt: Date | null;
  location: string | null;
  reactionCount: number;
  publishedAt: Date | null;
  coverImageUrl: string | null;
}

export interface PublicContentImage {
  url: string;
  fileName: string;
}

export interface PublicContentDetail extends PublicContentItem {
  body: string;
  viewCount: number;
  images: PublicContentImage[];
  reactionBreakdown: Record<ReactionType, number>;
}

export interface PublicDesaContentItem extends PublicContentItem {
  rtCode: string;
  rtName: string;
}

export interface PublicRtSummary {
  code: string;
  name: string;
  contentCount: number;
}

export interface PublicDesaOverview {
  rts: PublicRtSummary[];
  latest: PublicDesaContentItem[];
}

export interface ReactionResult {
  reactionType: ReactionType | null;
  reactionCount: number;
  reactionBreakdown: Record<ReactionType, number>;
}
