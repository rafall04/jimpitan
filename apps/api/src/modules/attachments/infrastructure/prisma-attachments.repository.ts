/**
 * Purpose: Prisma adapter for attachment metadata persistence.
 * Caller: AttachmentsModule dependency injection for AttachmentsService.
 * Deps: PrismaService, Prisma attachment/announcement enums, attachment repository port + domain types.
 * MainFuncs: Creates image rows, resolves owned + public-servable images, soft deletes, and lists owner images.
 * SideEffects: Reads and writes attachments table rows.
 */
import { Injectable } from '@nestjs/common';
import { AttachmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AttachmentRole } from '../domain/attachment.types';
import type {
  AttachmentRow,
  AttachmentsRepositoryPort,
  CreateAttachmentInput,
  ServableImageRow,
} from './attachments.repository.port';

type AttachmentRecord = Prisma.AttachmentGetPayload<Record<string, never>>;

@Injectable()
export class PrismaAttachmentsRepository implements AttachmentsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createImage(input: CreateAttachmentInput): Promise<AttachmentRow> {
    const created = await this.prisma.attachment.create({
      data: {
        rtId: input.rtId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        announcementId: input.announcementId ?? null,
        status: AttachmentStatus.UPLOADED,
        bucket: input.bucket,
        objectKey: input.objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: BigInt(input.sizeBytes),
        checksum: input.checksum ?? null,
        metadata: { role: input.role, sortOrder: input.sortOrder },
        uploadedById: input.uploadedById,
        completedAt: new Date(),
      },
    });
    return this.toRow(created);
  }

  async findOwnedImage(rtId: string, attachmentId: string): Promise<AttachmentRow | null> {
    const record = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, rtId, deletedAt: null },
    });
    return record ? this.toRow(record) : null;
  }

  // Images are served publicly by their unguessable UUID. Content is public-only by product decision,
  // so we intentionally do not gate on the owning post's publish state (lets the dashboard preview drafts).
  async findPublicServableImage(attachmentId: string): Promise<ServableImageRow | null> {
    const record = await this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        status: AttachmentStatus.UPLOADED,
        deletedAt: null,
      },
      select: { objectKey: true, mimeType: true, fileName: true },
    });
    return record ? { objectKey: record.objectKey, mimeType: record.mimeType, fileName: record.fileName } : null;
  }

  async softDeleteImage(rtId: string, attachmentId: string, deletedById: string): Promise<AttachmentRow | null> {
    const updated = await this.prisma.attachment.updateMany({
      where: { id: attachmentId, rtId, deletedAt: null },
      data: { status: AttachmentStatus.DELETED, deletedAt: new Date(), deletedById },
    });
    if (updated.count === 0) {
      return null;
    }
    const record = await this.prisma.attachment.findFirst({ where: { id: attachmentId, rtId } });
    return record ? this.toRow(record) : null;
  }

  async listImagesForOwner(rtId: string, ownerId: string): Promise<AttachmentRow[]> {
    const records = await this.prisma.attachment.findMany({
      where: { rtId, ownerId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return records.map((record) => this.toRow(record)).sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private toRow(record: AttachmentRecord): AttachmentRow {
    const metadata = (record.metadata ?? {}) as { role?: string; sortOrder?: number };
    const role: AttachmentRole = metadata.role === 'cover' ? 'cover' : 'gallery';
    return {
      id: record.id,
      rtId: record.rtId,
      ownerType: record.ownerType,
      ownerId: record.ownerId,
      announcementId: record.announcementId ?? null,
      objectKey: record.objectKey,
      bucket: record.bucket,
      fileName: record.fileName,
      mimeType: record.mimeType,
      sizeBytes: Number(record.sizeBytes),
      role,
      sortOrder: typeof metadata.sortOrder === 'number' ? metadata.sortOrder : 0,
      createdAt: record.createdAt,
    };
  }
}
