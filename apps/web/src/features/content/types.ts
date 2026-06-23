/**
 * Purpose: Frontend types for tenant-scoped content authoring and images.
 * Caller: Content API adapter, hooks, forms, and pages.
 * Deps: None.
 * MainFuncs: Mirrors backend content contracts (posts, images, list params, payloads).
 * SideEffects: None.
 */
export type ContentType = 'ANNOUNCEMENT' | 'ACTIVITY' | 'ARTICLE' | 'GALLERY';
export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ContentVisibility = 'PUBLIC' | 'MEMBERS';
export type ReactionType = 'LIKE' | 'LOVE' | 'SUPPORT';

export interface ContentImageRef {
  id: string;
  role: 'cover' | 'gallery';
  sortOrder: number;
  fileName: string;
  mimeType: string;
  url: string;
}

export interface ContentListRow {
  id: string;
  type: ContentType;
  status: ContentStatus;
  visibility: ContentVisibility;
  title: string;
  slug: string | null;
  excerpt: string | null;
  eventStartAt: string | null;
  location: string | null;
  reactionCount: number;
  viewCount: number;
  publishedAt: string | null;
  coverImage: ContentImageRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentPostRecord {
  id: string;
  type: ContentType;
  status: ContentStatus;
  visibility: ContentVisibility;
  title: string;
  slug: string | null;
  excerpt: string | null;
  body: string;
  eventStartAt: string | null;
  eventEndAt: string | null;
  location: string | null;
  reactionCount: number;
  viewCount: number;
  publishedAt: string | null;
  coverImage: ContentImageRef | null;
  images: ContentImageRef[];
  createdBy: { id: string; fullName: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ContentListParams = {
  page?: number;
  limit?: number;
  type?: ContentType;
  status?: ContentStatus;
  search?: string;
};

export interface CreateContentPayload {
  type: ContentType;
  title: string;
  body: string;
  excerpt?: string;
  visibility?: ContentVisibility;
  eventStartAt?: string;
  eventEndAt?: string;
  location?: string;
  publish?: boolean;
}

export interface UpdateContentPayload {
  title?: string;
  body?: string;
  excerpt?: string | null;
  visibility?: ContentVisibility;
  eventStartAt?: string | null;
  eventEndAt?: string | null;
  location?: string | null;
}
