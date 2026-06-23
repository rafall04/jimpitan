/**
 * Purpose: Persistence port for attachment metadata rows.
 * Caller: AttachmentsService (via ATTACHMENTS_REPOSITORY token); implemented by PrismaAttachmentsRepository.
 * Deps: Prisma AttachmentOwnerType enum, attachment domain types.
 * MainFuncs: Declares image create, owned lookup, public servable lookup, soft delete, and owner listing.
 * SideEffects: None (interface only).
 */
import type { AttachmentOwnerType } from '@prisma/client';
import type { AttachmentRole } from '../domain/attachment.types';

export interface CreateAttachmentInput {
  rtId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  announcementId?: string | null;
  bucket: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string | null;
  role: AttachmentRole;
  sortOrder: number;
  uploadedById: string;
}

export interface AttachmentRow {
  id: string;
  rtId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  announcementId: string | null;
  objectKey: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  role: AttachmentRole;
  sortOrder: number;
  createdAt: Date;
}

export interface ServableImageRow {
  objectKey: string;
  mimeType: string;
  fileName: string;
}

export interface AttachmentsRepositoryPort {
  createImage(input: CreateAttachmentInput): Promise<AttachmentRow>;
  findOwnedImage(rtId: string, attachmentId: string): Promise<AttachmentRow | null>;
  findPublicServableImage(attachmentId: string): Promise<ServableImageRow | null>;
  softDeleteImage(rtId: string, attachmentId: string, deletedById: string): Promise<AttachmentRow | null>;
  listImagesForOwner(rtId: string, ownerId: string): Promise<AttachmentRow[]>;
}
