/**
 * Purpose: Prisma adapter for content posts, reactions, and public content reads.
 * Caller: ContentModule dependency injection for ContentService.
 * Deps: PrismaService, ConfigService, Prisma content/attachment/audit enums, content port + domain types, attachment URL helper, content policy.
 * MainFuncs: Tenant-scoped authoring CRUD with in-transaction audit, slug checks, public feeds/detail (+view count), and deduped reactions with a count mirror.
 * SideEffects: Reads/writes announcements, post_reactions, and audit_logs table rows.
 */
import { Injectable } from '@nestjs/common';
import {
  AnnouncementStatus,
  AnnouncementVisibility,
  AttachmentStatus,
  AuditActorType,
  ContentType,
  Prisma,
  ReactionType,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { AttachmentImageRef, AttachmentRole } from '../../attachments/domain/attachment.types';
import { buildPublicImagePath } from '../../attachments/domain/attachment.types';
import type { ContentRequestMeta } from '../application/content.commands';
import { pathForContentType } from '../domain/content.policy';
import type {
  ContentListRow,
  ContentPostRecord,
  PublicContentDetail,
  PublicContentItem,
  PublicDesaOverview,
  ReactionResult,
} from '../domain/content.types';
import type {
  ContentListFilter,
  ContentRepositoryPort,
  CreatePostData,
  PublicContentFilter,
  ReactionData,
  UpdatePostData,
} from './content.repository.port';

type AttachmentMappable = { id: string; fileName: string; mimeType: string; metadata: Prisma.JsonValue };

interface PostScalars {
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
  createdAt: Date;
  updatedAt: Date;
}

type PostWithImages = PostScalars & { attachments: AttachmentMappable[] };
type PostWithAuthor = PostWithImages & { createdBy: { id: string; fullName: string } | null };

@Injectable()
export class PrismaContentRepository implements ContentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(rtId: string, data: CreatePostData, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<ContentPostRecord> {
    const created = await this.prisma.$transaction(async (tx) => {
      const post = await tx.announcement.create({
        data: {
          rtId,
          type: data.type,
          title: data.title,
          body: data.body,
          excerpt: data.excerpt,
          slug: data.slug,
          visibility: data.visibility,
          status: data.status,
          publishedAt: data.status === AnnouncementStatus.PUBLISHED ? new Date() : null,
          eventStartAt: data.eventStartAt,
          eventEndAt: data.eventEndAt,
          location: data.location,
          createdById: actor.userId,
        },
        include: this.postInclude(),
      });
      await this.writeAudit(tx, { rtId, actor, meta, action: 'CONTENT_POST_CREATED', entityId: post.id, afterData: this.auditSnapshot(post) });
      return post;
    });
    return this.toPostRecord(created);
  }

  async updatePost(rtId: string, postId: string, data: UpdatePostData, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<ContentPostRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.announcement.findFirst({ where: { id: postId, rtId, deletedAt: null } });
      if (!before) {
        return null;
      }
      await tx.announcement.update({
        where: { id: postId },
        data: {
          title: data.title,
          body: data.body,
          excerpt: data.excerpt,
          visibility: data.visibility,
          eventStartAt: data.eventStartAt,
          eventEndAt: data.eventEndAt,
          location: data.location,
          updatedById: actor.userId,
        },
      });
      const after = await tx.announcement.findFirst({ where: { id: postId, rtId }, include: this.postInclude() });
      await this.writeAudit(tx, { rtId, actor, meta, action: 'CONTENT_POST_UPDATED', entityId: postId, beforeData: this.auditSnapshot(before), afterData: after ? this.auditSnapshot(after) : undefined });
      return after ? this.toPostRecord(after) : null;
    });
  }

  async publishPost(rtId: string, postId: string, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<ContentPostRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.announcement.findFirst({ where: { id: postId, rtId, deletedAt: null } });
      if (!before) {
        return null;
      }
      await tx.announcement.update({
        where: { id: postId },
        data: {
          status: AnnouncementStatus.PUBLISHED,
          publishedAt: before.publishedAt ?? new Date(),
          updatedById: actor.userId,
        },
      });
      const after = await tx.announcement.findFirst({ where: { id: postId, rtId }, include: this.postInclude() });
      await this.writeAudit(tx, { rtId, actor, meta, action: 'CONTENT_POST_PUBLISHED', entityId: postId, beforeData: this.auditSnapshot(before), afterData: after ? this.auditSnapshot(after) : undefined });
      return after ? this.toPostRecord(after) : null;
    });
  }

  async archivePost(rtId: string, postId: string, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<ContentPostRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.announcement.findFirst({ where: { id: postId, rtId, deletedAt: null } });
      if (!before) {
        return null;
      }
      await tx.announcement.update({ where: { id: postId }, data: { status: AnnouncementStatus.ARCHIVED, updatedById: actor.userId } });
      const after = await tx.announcement.findFirst({ where: { id: postId, rtId }, include: this.postInclude() });
      await this.writeAudit(tx, { rtId, actor, meta, action: 'CONTENT_POST_ARCHIVED', entityId: postId, beforeData: this.auditSnapshot(before), afterData: after ? this.auditSnapshot(after) : undefined });
      return after ? this.toPostRecord(after) : null;
    });
  }

  async deletePost(rtId: string, postId: string, actor: AuthPrincipal, meta: ContentRequestMeta): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.announcement.findFirst({ where: { id: postId, rtId, deletedAt: null } });
      if (!before) {
        return false;
      }
      await tx.announcement.update({ where: { id: postId }, data: { deletedAt: new Date(), deletedById: actor.userId } });
      await this.writeAudit(tx, { rtId, actor, meta, action: 'CONTENT_POST_DELETED', entityId: postId, beforeData: this.auditSnapshot(before) });
      return true;
    });
  }

  async listPosts(rtId: string, filter: ContentListFilter): Promise<PaginatedResult<ContentListRow>> {
    const where: Prisma.AnnouncementWhereInput = {
      rtId,
      deletedAt: null,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.search ? { title: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        include: this.coverInclude(),
        orderBy: [{ createdAt: 'desc' }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return this.paginate(rows.map((row) => this.toListRow(row)), filter.page, filter.limit, total);
  }

  async findPostById(rtId: string, postId: string): Promise<ContentPostRecord | null> {
    const record = await this.prisma.announcement.findFirst({ where: { id: postId, rtId, deletedAt: null }, include: this.postInclude() });
    return record ? this.toPostRecord(record) : null;
  }

  async slugExists(rtId: string, slug: string, exceptId?: string): Promise<boolean> {
    const count = await this.prisma.announcement.count({
      where: { rtId, slug, deletedAt: null, ...(exceptId ? { id: { not: exceptId } } : {}) },
    });
    return count > 0;
  }

  async listPublicPosts(rtCode: string, filter: PublicContentFilter): Promise<PaginatedResult<PublicContentItem> | null> {
    const rt = await this.findPublicRt(rtCode);
    if (!rt) {
      return null;
    }
    const where: Prisma.AnnouncementWhereInput = {
      rtId: rt.id,
      status: AnnouncementStatus.PUBLISHED,
      visibility: AnnouncementVisibility.PUBLIC,
      deletedAt: null,
      publishedAt: { not: null },
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.search ? { title: { contains: filter.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        include: this.coverInclude(),
        orderBy: [{ publishedAt: 'desc' }],
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return this.paginate(rows.map((row) => this.toPublicItem(row)), filter.page, filter.limit, total);
  }

  async getPublicDesaOverview(limit: number): Promise<PublicDesaOverview> {
    const publishedWhere: Prisma.AnnouncementWhereInput = {
      status: AnnouncementStatus.PUBLISHED,
      visibility: AnnouncementVisibility.PUBLIC,
      deletedAt: null,
      publishedAt: { not: null },
    };
    const [rts, grouped, rows] = await Promise.all([
      this.prisma.rt.findMany({ where: { isActive: true, deletedAt: null }, select: { id: true, code: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.announcement.groupBy({ by: ['rtId'], where: publishedWhere, _count: { _all: true }, orderBy: { rtId: 'asc' } }),
      this.prisma.announcement.findMany({
        where: publishedWhere,
        include: {
          attachments: { where: { deletedAt: null, status: AttachmentStatus.UPLOADED, metadata: { path: ['role'], equals: 'cover' } }, take: 1 },
          rt: { select: { code: true, name: true } },
        },
        orderBy: [{ publishedAt: 'desc' }],
        take: limit,
      }),
    ]);
    const countByRt = new Map(grouped.map((group) => [group.rtId, group._count._all]));
    return {
      rts: rts.map((rt) => ({ code: rt.code, name: rt.name, contentCount: countByRt.get(rt.id) ?? 0 })),
      latest: rows.map((row) => ({ ...this.toPublicItem(row), rtCode: row.rt.code, rtName: row.rt.name })),
    };
  }

  async findPublicPostBySlug(rtCode: string, type: ContentType, slug: string): Promise<PublicContentDetail | null> {
    const rt = await this.findPublicRt(rtCode);
    if (!rt) {
      return null;
    }
    const record = await this.prisma.announcement.findFirst({
      where: { rtId: rt.id, type, slug, status: AnnouncementStatus.PUBLISHED, visibility: AnnouncementVisibility.PUBLIC, deletedAt: null },
      include: this.postInclude(),
    });
    if (!record) {
      return null;
    }
    // Best-effort view increment (never blocks a read).
    await this.prisma.announcement.update({ where: { id: record.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
    const breakdown = await this.reactionBreakdown(record.id);
    const { cover, images } = this.splitImages(record.attachments);
    return {
      type: record.type,
      typePath: pathForContentType(record.type),
      title: record.title,
      slug: record.slug ?? '',
      excerpt: record.excerpt,
      eventStartAt: record.eventStartAt,
      eventEndAt: record.eventEndAt,
      location: record.location,
      reactionCount: record.reactionCount,
      publishedAt: record.publishedAt,
      coverImageUrl: cover?.url ?? null,
      body: record.body,
      viewCount: record.viewCount + 1,
      images: images.map((image) => ({ url: image.url, fileName: image.fileName })),
      reactionBreakdown: breakdown,
    };
  }

  async reactToPost(rtCode: string, type: ContentType, slug: string, input: ReactionData): Promise<ReactionResult | null> {
    const rt = await this.findPublicRt(rtCode);
    if (!rt) {
      return null;
    }
    const post = await this.prisma.announcement.findFirst({
      where: { rtId: rt.id, type, slug, status: AnnouncementStatus.PUBLISHED, visibility: AnnouncementVisibility.PUBLIC, deletedAt: null },
      select: { id: true, rtId: true },
    });
    if (!post) {
      return null;
    }
    const total = await this.prisma.$transaction(async (tx) => {
      await tx.postReaction.upsert({
        where: { announcementId_visitorHash: { announcementId: post.id, visitorHash: input.visitorHash } },
        update: { reactionType: input.reactionType, ipHash: input.ipHash },
        create: { rtId: post.rtId, announcementId: post.id, reactionType: input.reactionType, visitorHash: input.visitorHash, ipHash: input.ipHash },
      });
      const count = await tx.postReaction.count({ where: { announcementId: post.id } });
      await tx.announcement.update({ where: { id: post.id }, data: { reactionCount: count } });
      return count;
    });
    const breakdown = await this.reactionBreakdown(post.id);
    return { reactionType: input.reactionType, reactionCount: total, reactionBreakdown: breakdown };
  }

  private postInclude() {
    return {
      attachments: { where: { deletedAt: null, status: AttachmentStatus.UPLOADED }, orderBy: { createdAt: Prisma.SortOrder.asc } },
      createdBy: { select: { id: true, fullName: true } },
    } satisfies Prisma.AnnouncementInclude;
  }

  private coverInclude() {
    return {
      attachments: {
        where: { deletedAt: null, status: AttachmentStatus.UPLOADED, metadata: { path: ['role'], equals: 'cover' } },
        take: 1,
      },
    } satisfies Prisma.AnnouncementInclude;
  }

  private async findPublicRt(rtCode: string) {
    return this.prisma.rt.findFirst({
      where: { code: { equals: rtCode.trim(), mode: 'insensitive' }, isActive: true, deletedAt: null },
      select: { id: true, code: true, name: true },
    });
  }

  private async reactionBreakdown(announcementId: string): Promise<Record<ReactionType, number>> {
    const grouped = await this.prisma.postReaction.groupBy({ by: ['reactionType'], where: { announcementId }, _count: { _all: true } });
    const result = Object.values(ReactionType).reduce((accumulator, value) => {
      accumulator[value] = 0;
      return accumulator;
    }, {} as Record<ReactionType, number>);
    for (const row of grouped) {
      result[row.reactionType] = row._count._all;
    }
    return result;
  }

  private toImageRef(attachment: AttachmentMappable): AttachmentImageRef {
    const metadata = (attachment.metadata ?? {}) as { role?: string; sortOrder?: number };
    const role: AttachmentRole = metadata.role === 'cover' ? 'cover' : 'gallery';
    return {
      id: attachment.id,
      role,
      sortOrder: typeof metadata.sortOrder === 'number' ? metadata.sortOrder : 0,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      url: buildPublicImagePath(attachment.id),
    };
  }

  private splitImages(attachments: AttachmentMappable[]): { cover: AttachmentImageRef | null; images: AttachmentImageRef[] } {
    const refs = attachments.map((attachment) => this.toImageRef(attachment));
    const cover = refs.find((ref) => ref.role === 'cover') ?? null;
    const images = refs.filter((ref) => ref.role === 'gallery').sort((left, right) => left.sortOrder - right.sortOrder);
    return { cover, images };
  }

  private toListRow(record: PostWithImages): ContentListRow {
    const { cover } = this.splitImages(record.attachments);
    return {
      id: record.id,
      type: record.type,
      status: record.status,
      visibility: record.visibility,
      title: record.title,
      slug: record.slug,
      excerpt: record.excerpt,
      eventStartAt: record.eventStartAt,
      location: record.location,
      reactionCount: record.reactionCount,
      viewCount: record.viewCount,
      publishedAt: record.publishedAt,
      coverImage: cover,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toPostRecord(record: PostWithAuthor): ContentPostRecord {
    const { cover, images } = this.splitImages(record.attachments);
    return {
      id: record.id,
      type: record.type,
      status: record.status,
      visibility: record.visibility,
      title: record.title,
      slug: record.slug,
      excerpt: record.excerpt,
      body: record.body,
      eventStartAt: record.eventStartAt,
      eventEndAt: record.eventEndAt,
      location: record.location,
      reactionCount: record.reactionCount,
      viewCount: record.viewCount,
      publishedAt: record.publishedAt,
      coverImage: cover,
      images,
      createdBy: record.createdBy ? { id: record.createdBy.id, fullName: record.createdBy.fullName } : null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toPublicItem(record: PostWithImages): PublicContentItem {
    const { cover } = this.splitImages(record.attachments);
    return {
      type: record.type,
      typePath: pathForContentType(record.type),
      title: record.title,
      slug: record.slug ?? '',
      excerpt: record.excerpt,
      eventStartAt: record.eventStartAt,
      eventEndAt: record.eventEndAt,
      location: record.location,
      reactionCount: record.reactionCount,
      publishedAt: record.publishedAt,
      coverImageUrl: cover?.url ?? null,
    };
  }

  private paginate<T>(items: T[], page: number, limit: number, total: number): PaginatedResult<T> {
    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  private auditSnapshot(record: PostScalars): Record<string, unknown> {
    return { title: record.title, type: record.type, status: record.status, visibility: record.visibility, slug: record.slug };
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    input: { rtId: string; actor: AuthPrincipal; meta: ContentRequestMeta; action: string; entityId: string; beforeData?: unknown; afterData?: unknown },
  ): Promise<void> {
    const data: Prisma.AuditLogUncheckedCreateInput = {
      rtId: input.rtId,
      actorUserId: input.actor.userId,
      actorType: AuditActorType.USER,
      action: input.action,
      entityType: 'ANNOUNCEMENT',
      entityId: input.entityId,
      requestId: input.meta.correlationId,
      correlationId: input.meta.correlationId,
      ipAddress: input.meta.ipAddress,
      userAgent: input.meta.userAgent,
    };
    if (input.beforeData !== undefined) {
      data.beforeData = input.beforeData as Prisma.InputJsonValue;
    }
    if (input.afterData !== undefined) {
      data.afterData = input.afterData as Prisma.InputJsonValue;
    }
    await tx.auditLog.create({ data });
  }
}
