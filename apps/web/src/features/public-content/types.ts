/**
 * Purpose: Public-safe content types for the transparency site.
 * Caller: Public content API adapter, components, and pages.
 * Deps: None.
 * MainFuncs: Mirrors the backend public content feed/detail/reaction contracts.
 * SideEffects: None.
 */
export type ContentType = 'ANNOUNCEMENT' | 'ACTIVITY' | 'ARTICLE' | 'GALLERY';
export type ReactionType = 'LIKE' | 'LOVE' | 'SUPPORT';

export interface PublicContentItem {
  type: ContentType;
  typePath: string;
  title: string;
  slug: string;
  excerpt: string | null;
  eventStartAt: string | null;
  eventEndAt: string | null;
  location: string | null;
  reactionCount: number;
  publishedAt: string | null;
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

export interface PublicPaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReactionResult {
  reactionType: ReactionType;
  reactionCount: number;
  reactionBreakdown: Record<ReactionType, number>;
}

export interface PublicContentListParams {
  page?: number;
  type?: ContentType;
  search?: string;
}
