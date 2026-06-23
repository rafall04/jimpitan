/**
 * Purpose: Attachment domain types shared across the attachments module boundary.
 * Caller: AttachmentsService, repository port, and content module consumers.
 * Deps: Prisma AttachmentOwnerType enum.
 * MainFuncs: Defines upload commands, uploaded-file shape, image references, and servable image payloads.
 * SideEffects: None.
 */
import type { AttachmentOwnerType } from '@prisma/client';

export type AttachmentRole = 'cover' | 'gallery';

export interface UploadImageCommand {
  ownerType: AttachmentOwnerType;
  ownerId: string;
  announcementId?: string | null;
  role: AttachmentRole;
  sortOrder?: number;
}

export interface UploadedImageFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface AttachmentImageRef {
  id: string;
  role: AttachmentRole;
  sortOrder: number;
  fileName: string;
  mimeType: string;
  url: string;
}

export interface ServableImage {
  data: Buffer;
  mimeType: string;
  fileName: string;
}

// Strip any path components and unsafe characters from a user-provided file name.
export function sanitizeFileName(name: string | undefined): string {
  const base = (name ?? 'image').split(/[\\/]/).pop() ?? 'image';
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return cleaned.length > 0 ? cleaned : 'image';
}

// Public path RELATIVE to the API base URL for serving a stored image; matches AttachmentsController route.
// Returned relative because NEXT_PUBLIC_API_BASE_URL already includes the `/api/v1` prefix the frontend joins onto.
export function buildPublicImagePath(attachmentId: string): string {
  return `attachments/public/${attachmentId}`;
}
