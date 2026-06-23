/**
 * Purpose: Application service for tenant-scoped content authoring, media, and public content interaction.
 * Caller: ContentController (authoring) and PublicContentController (public reads + reactions).
 * Deps: CONTENT_REPOSITORY port, AttachmentsService, Prisma content enums, slug util, content policy, command contracts.
 * MainFuncs: Enforces slug uniqueness, publish lifecycle, event-date validation, cover/gallery image rules, and public lookups.
 * SideEffects: Persists content + reactions via the repository and image bytes via AttachmentsService.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AnnouncementStatus, AnnouncementVisibility, AttachmentOwnerType } from '@prisma/client';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { AttachmentsService } from '../../attachments/application/attachments.service';
import type { AttachmentImageRef, UploadedImageFile } from '../../attachments/domain/attachment.types';
import { contentTypeFromPath } from '../domain/content.policy';
import type {
  ContentListRow,
  ContentPostRecord,
  PublicContentDetail,
  PublicContentItem,
  ReactionResult,
} from '../domain/content.types';
import { ensureUniqueSlug } from '../domain/slug.util';
import { CONTENT_REPOSITORY } from '../content.tokens';
import type { ContentRepositoryPort } from '../infrastructure/content.repository.port';
import type {
  ContentListQuery,
  ContentRequestMeta,
  CreatePostCommand,
  PublicContentListQuery,
  ReactionInput,
  UpdatePostCommand,
} from './content.commands';

@Injectable()
export class ContentService {
  constructor(
    @Inject(CONTENT_REPOSITORY) private readonly repository: ContentRepositoryPort,
    @Inject(AttachmentsService) private readonly attachments: AttachmentsService,
  ) {}

  listPosts(actor: AuthPrincipal, query: ContentListQuery): Promise<PaginatedResult<ContentListRow>> {
    return this.repository.listPosts(actor.rtId, query);
  }

  async getPost(actor: AuthPrincipal, postId: string): Promise<ContentPostRecord> {
    return this.assertPostExists(actor, postId);
  }

  async createPost(actor: AuthPrincipal, command: CreatePostCommand, meta: ContentRequestMeta): Promise<ContentPostRecord> {
    const eventStartAt = this.parseDateForCreate(command.eventStartAt);
    const eventEndAt = this.parseDateForCreate(command.eventEndAt);
    this.assertEventRange(eventStartAt, eventEndAt);
    const slug = await ensureUniqueSlug(command.title, (candidate) => this.repository.slugExists(actor.rtId, candidate));
    const status = command.publish ? AnnouncementStatus.PUBLISHED : AnnouncementStatus.DRAFT;
    return this.repository.createPost(
      actor.rtId,
      {
        type: command.type,
        title: command.title,
        body: command.body,
        excerpt: command.excerpt ?? null,
        slug,
        visibility: command.visibility ?? AnnouncementVisibility.PUBLIC,
        status,
        eventStartAt,
        eventEndAt,
        location: command.location ?? null,
      },
      actor,
      meta,
    );
  }

  async updatePost(actor: AuthPrincipal, postId: string, command: UpdatePostCommand, meta: ContentRequestMeta): Promise<ContentPostRecord> {
    await this.assertPostExists(actor, postId);
    const eventStartAt = this.parseDateForUpdate(command.eventStartAt);
    const eventEndAt = this.parseDateForUpdate(command.eventEndAt);
    if (eventStartAt instanceof Date && eventEndAt instanceof Date) {
      this.assertEventRange(eventStartAt, eventEndAt);
    }
    const updated = await this.repository.updatePost(
      actor.rtId,
      postId,
      {
        title: command.title,
        body: command.body,
        excerpt: command.excerpt,
        visibility: command.visibility,
        eventStartAt,
        eventEndAt,
        location: command.location,
      },
      actor,
      meta,
    );
    if (!updated) {
      throw new NotFoundException('Konten tidak ditemukan.');
    }
    return updated;
  }

  async publishPost(actor: AuthPrincipal, postId: string, meta: ContentRequestMeta): Promise<ContentPostRecord> {
    const updated = await this.repository.publishPost(actor.rtId, postId, actor, meta);
    if (!updated) {
      throw new NotFoundException('Konten tidak ditemukan.');
    }
    return updated;
  }

  async archivePost(actor: AuthPrincipal, postId: string, meta: ContentRequestMeta): Promise<ContentPostRecord> {
    const updated = await this.repository.archivePost(actor.rtId, postId, actor, meta);
    if (!updated) {
      throw new NotFoundException('Konten tidak ditemukan.');
    }
    return updated;
  }

  async deletePost(actor: AuthPrincipal, postId: string, meta: ContentRequestMeta): Promise<void> {
    const deleted = await this.repository.deletePost(actor.rtId, postId, actor, meta);
    if (!deleted) {
      throw new NotFoundException('Konten tidak ditemukan.');
    }
  }

  async listImages(actor: AuthPrincipal, postId: string): Promise<AttachmentImageRef[]> {
    await this.assertPostExists(actor, postId);
    return this.attachments.listOwnerImages(actor.rtId, postId);
  }

  async uploadCoverImage(actor: AuthPrincipal, postId: string, file: UploadedImageFile): Promise<AttachmentImageRef> {
    await this.assertPostExists(actor, postId);
    const existing = await this.attachments.listOwnerImages(actor.rtId, postId);
    const currentCover = existing.find((image) => image.role === 'cover');
    if (currentCover) {
      // A post has at most one cover; replace the previous one.
      await this.attachments.deleteImage(actor, currentCover.id);
    }
    return this.attachments.uploadImage(actor, { ownerType: AttachmentOwnerType.ANNOUNCEMENT, ownerId: postId, announcementId: postId, role: 'cover', sortOrder: 0 }, file);
  }

  async addGalleryImage(actor: AuthPrincipal, postId: string, file: UploadedImageFile): Promise<AttachmentImageRef> {
    await this.assertPostExists(actor, postId);
    const existing = await this.attachments.listOwnerImages(actor.rtId, postId);
    const nextOrder = existing.filter((image) => image.role === 'gallery').length;
    return this.attachments.uploadImage(actor, { ownerType: AttachmentOwnerType.ANNOUNCEMENT, ownerId: postId, announcementId: postId, role: 'gallery', sortOrder: nextOrder }, file);
  }

  async removeImage(actor: AuthPrincipal, postId: string, attachmentId: string): Promise<void> {
    await this.assertPostExists(actor, postId);
    await this.attachments.deleteImage(actor, attachmentId);
  }

  async listPublicPosts(rtCode: string, query: PublicContentListQuery): Promise<PaginatedResult<PublicContentItem>> {
    const result = await this.repository.listPublicPosts(rtCode, query);
    if (!result) {
      throw new NotFoundException('RT tidak ditemukan.');
    }
    return result;
  }

  async getPublicPost(rtCode: string, typePath: string, slug: string): Promise<PublicContentDetail> {
    const type = contentTypeFromPath(typePath);
    if (!type) {
      throw new NotFoundException('Jenis konten tidak dikenal.');
    }
    const detail = await this.repository.findPublicPostBySlug(rtCode, type, slug);
    if (!detail) {
      throw new NotFoundException('Konten tidak ditemukan.');
    }
    return detail;
  }

  async reactToPublicPost(rtCode: string, typePath: string, slug: string, input: ReactionInput): Promise<ReactionResult> {
    const type = contentTypeFromPath(typePath);
    if (!type) {
      throw new NotFoundException('Jenis konten tidak dikenal.');
    }
    const result = await this.repository.reactToPost(rtCode, type, slug, input);
    if (!result) {
      throw new NotFoundException('Konten tidak ditemukan.');
    }
    return result;
  }

  private async assertPostExists(actor: AuthPrincipal, postId: string): Promise<ContentPostRecord> {
    const post = await this.repository.findPostById(actor.rtId, postId);
    if (!post) {
      throw new NotFoundException('Konten tidak ditemukan.');
    }
    return post;
  }

  private assertEventRange(start: Date | null, end: Date | null): void {
    if (start && end && end.getTime() < start.getTime()) {
      throw new BadRequestException('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    }
  }

  private parseDateForCreate(value?: string): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Tanggal tidak valid.');
    }
    return date;
  }

  private parseDateForUpdate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === '') {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Tanggal tidak valid.');
    }
    return date;
  }
}
