/**
 * Purpose: Application service for image upload, public serving, and lifecycle of content attachments.
 * Caller: AttachmentsController (public serve) and the content module (upload/list/delete).
 * Deps: ATTACHMENTS_REPOSITORY + STORAGE_PORT tokens, ConfigService, image validation, node:crypto, AuthPrincipal.
 * MainFuncs: Validates and stores uploaded images, builds public URLs, serves public images, soft-deletes images.
 * SideEffects: Writes/removes object bytes via the storage port and attachment rows via the repository.
 */
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { ATTACHMENTS_REPOSITORY, STORAGE_PORT } from '../attachments.tokens';
import type {
  AttachmentImageRef,
  ServableImage,
  UploadImageCommand,
  UploadedImageFile,
} from '../domain/attachment.types';
import { buildPublicImagePath, sanitizeFileName } from '../domain/attachment.types';
import { validateImageUpload } from '../domain/image-validation';
import type { AttachmentRow, AttachmentsRepositoryPort } from '../infrastructure/attachments.repository.port';
import type { StoragePort } from '../infrastructure/storage.port';

@Injectable()
export class AttachmentsService {
  private readonly maxUploadBytes: number;

  constructor(
    @Inject(ATTACHMENTS_REPOSITORY) private readonly repository: AttachmentsRepositoryPort,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.maxUploadBytes = config.get<number>('storage.maxUploadBytes', 5 * 1024 * 1024);
  }

  async uploadImage(actor: AuthPrincipal, command: UploadImageCommand, file: UploadedImageFile): Promise<AttachmentImageRef> {
    const validated = validateImageUpload({ buffer: file.buffer, declaredMimeType: file.mimeType, maxBytes: this.maxUploadBytes });
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const objectKey = `content/${actor.rtId}/${randomUUID()}.${validated.extension}`;

    await this.storage.put({ objectKey, data: file.buffer, contentType: validated.mimeType });

    try {
      const row = await this.repository.createImage({
        rtId: actor.rtId,
        ownerType: command.ownerType,
        ownerId: command.ownerId,
        announcementId: command.announcementId ?? null,
        bucket: this.storage.bucket,
        objectKey,
        fileName: sanitizeFileName(file.originalName),
        mimeType: validated.mimeType,
        sizeBytes: file.buffer.length,
        checksum,
        role: command.role,
        sortOrder: command.sortOrder ?? 0,
        uploadedById: actor.userId,
      });
      return this.toImageRef(row);
    } catch (error) {
      // Avoid orphaned files when the metadata row fails to persist.
      await this.storage.delete(objectKey).catch(() => undefined);
      throw error;
    }
  }

  async getPublicImage(attachmentId: string): Promise<ServableImage> {
    const row = await this.repository.findPublicServableImage(attachmentId);
    if (!row) {
      throw new NotFoundException('Gambar tidak ditemukan.');
    }
    const data = await this.storage.get(row.objectKey);
    return { data, mimeType: row.mimeType, fileName: row.fileName };
  }

  async deleteImage(actor: AuthPrincipal, attachmentId: string): Promise<void> {
    const row = await this.repository.softDeleteImage(actor.rtId, attachmentId, actor.userId);
    if (!row) {
      throw new NotFoundException('Gambar tidak ditemukan.');
    }
    // Best-effort physical removal; the row is already soft-deleted for integrity.
    await this.storage.delete(row.objectKey).catch(() => undefined);
  }

  async listOwnerImages(rtId: string, ownerId: string): Promise<AttachmentImageRef[]> {
    const rows = await this.repository.listImagesForOwner(rtId, ownerId);
    return rows.map((row) => this.toImageRef(row));
  }

  buildImagePath(attachmentId: string): string {
    return buildPublicImagePath(attachmentId);
  }

  private toImageRef(row: AttachmentRow): AttachmentImageRef {
    return {
      id: row.id,
      role: row.role,
      sortOrder: row.sortOrder,
      fileName: row.fileName,
      mimeType: row.mimeType,
      url: this.buildImagePath(row.id),
    };
  }
}
