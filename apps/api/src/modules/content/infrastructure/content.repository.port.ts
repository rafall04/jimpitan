/**
 * Purpose: Persistence port for content posts, reactions, and public reads.
 * Caller: ContentService (via CONTENT_REPOSITORY token); implemented by PrismaContentRepository.
 * Deps: Prisma content enums, AuthPrincipal, paginated result, content domain types, request meta.
 * MainFuncs: Declares tenant-scoped authoring CRUD, slug checks, public feeds, detail reads, and reactions.
 * SideEffects: None (interface only).
 */
import type { AnnouncementStatus, AnnouncementVisibility, ContentType, ReactionType } from '@prisma/client';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { ContentRequestMeta } from '../application/content.commands';
import type {
  ContentListRow,
  ContentPostRecord,
  PublicContentDetail,
  PublicContentItem,
  ReactionResult,
} from '../domain/content.types';

export interface CreatePostData {
  type: ContentType;
  title: string;
  body: string;
  excerpt: string | null;
  slug: string;
  visibility: AnnouncementVisibility;
  status: AnnouncementStatus;
  eventStartAt: Date | null;
  eventEndAt: Date | null;
  location: string | null;
}

export interface UpdatePostData {
  title?: string;
  body?: string;
  excerpt?: string | null;
  visibility?: AnnouncementVisibility;
  eventStartAt?: Date | null;
  eventEndAt?: Date | null;
  location?: string | null;
}

export interface ContentListFilter {
  page: number;
  limit: number;
  type?: ContentType;
  status?: AnnouncementStatus;
  search?: string;
}

export interface PublicContentFilter {
  page: number;
  limit: number;
  type?: ContentType;
  search?: string;
}

export interface ReactionData {
  reactionType: ReactionType;
  visitorHash: string;
  ipHash?: string;
}

export interface ContentRepositoryPort {
  createPost(rtId: string, data: CreatePostData, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<ContentPostRecord>;
  updatePost(rtId: string, postId: string, data: UpdatePostData, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<ContentPostRecord | null>;
  publishPost(rtId: string, postId: string, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<ContentPostRecord | null>;
  archivePost(rtId: string, postId: string, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<ContentPostRecord | null>;
  deletePost(rtId: string, postId: string, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<boolean>;
  listPosts(rtId: string, filter: ContentListFilter): Promise<PaginatedResult<ContentListRow>>;
  findPostById(rtId: string, postId: string): Promise<ContentPostRecord | null>;
  slugExists(rtId: string, slug: string, exceptId?: string): Promise<boolean>;
  listPublicPosts(rtCode: string, filter: PublicContentFilter): Promise<PaginatedResult<PublicContentItem> | null>;
  findPublicPostBySlug(rtCode: string, type: ContentType, slug: string): Promise<PublicContentDetail | null>;
  reactToPost(rtCode: string, type: ContentType, slug: string, input: ReactionData): Promise<ReactionResult | null>;
}
