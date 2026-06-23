/**
 * Purpose: Content domain policy — type/url-path mapping and publish lifecycle rules.
 * Caller: ContentService and the public content controller.
 * Deps: Prisma ContentType + AnnouncementStatus enums.
 * MainFuncs: Maps content types to Indonesian URL segments and validates lifecycle transitions.
 * SideEffects: None.
 */
import { AnnouncementStatus, ContentType } from '@prisma/client';

// Indonesian URL segment <-> content type. Drives /kegiatan, /pengumuman, /artikel, /galeri public routes.
export const CONTENT_TYPE_BY_PATH: Record<string, ContentType> = {
  pengumuman: ContentType.ANNOUNCEMENT,
  kegiatan: ContentType.ACTIVITY,
  artikel: ContentType.ARTICLE,
  galeri: ContentType.GALLERY,
};

export const PATH_BY_CONTENT_TYPE: Record<ContentType, string> = {
  [ContentType.ANNOUNCEMENT]: 'pengumuman',
  [ContentType.ACTIVITY]: 'kegiatan',
  [ContentType.ARTICLE]: 'artikel',
  [ContentType.GALLERY]: 'galeri',
};

export function contentTypeFromPath(path: string): ContentType | null {
  return CONTENT_TYPE_BY_PATH[path?.toLowerCase()] ?? null;
}

export function pathForContentType(type: ContentType): string {
  return PATH_BY_CONTENT_TYPE[type];
}

// A post can be (re)published from DRAFT or ARCHIVED.
export function canPublish(status: AnnouncementStatus): boolean {
  return status === AnnouncementStatus.DRAFT || status === AnnouncementStatus.ARCHIVED;
}
