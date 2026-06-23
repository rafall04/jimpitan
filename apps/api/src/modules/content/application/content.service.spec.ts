/**
 * Purpose: Unit tests for ContentService orchestration (slug, lifecycle, validation, public lookup).
 * Caller: Vitest API suite.
 * Deps: ContentService, fake repository + attachments service, Prisma content enums.
 * MainFuncs: Verifies slug generation/dedup, publish flag, event-date validation, and not-found mapping.
 * SideEffects: None.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AnnouncementStatus, AnnouncementVisibility, ContentType } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { ContentService } from './content.service';

const actor: AuthPrincipal = { userId: 'u1', membershipId: 'm1', rtId: 'rt1', roles: [], permissions: [] };
const meta = { correlationId: 'c1' };

function buildRepo(overrides: Record<string, unknown> = {}) {
  return {
    createPost: vi.fn(async (rtId: string, data: { slug: string; status: AnnouncementStatus; type: ContentType }) => ({ id: 'p1', ...data })),
    updatePost: vi.fn(),
    publishPost: vi.fn(),
    archivePost: vi.fn(),
    deletePost: vi.fn(),
    listPosts: vi.fn(),
    findPostById: vi.fn(async () => ({ id: 'p1' })),
    slugExists: vi.fn(async () => false),
    listPublicPosts: vi.fn(),
    findPublicPostBySlug: vi.fn(),
    reactToPost: vi.fn(),
    ...overrides,
  };
}

const attachments = { listOwnerImages: vi.fn(async () => []), uploadImage: vi.fn(), deleteImage: vi.fn() };

function buildService(overrides?: Record<string, unknown>) {
  const repo = buildRepo(overrides);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new ContentService(repo as any, attachments as any);
  return { repo, service };
}

describe('ContentService', () => {
  it('creates a draft post with a generated slug', async () => {
    const { repo, service } = buildService();
    await service.createPost(actor, { type: ContentType.ARTICLE, title: 'Sejarah RT Kita', body: 'isi' }, meta);
    expect(repo.createPost).toHaveBeenCalledWith(
      'rt1',
      expect.objectContaining({ slug: 'sejarah-rt-kita', status: AnnouncementStatus.DRAFT, visibility: AnnouncementVisibility.PUBLIC }),
      actor,
      meta,
    );
  });

  it('publishes immediately when the publish flag is set', async () => {
    const { repo, service } = buildService();
    await service.createPost(actor, { type: ContentType.ANNOUNCEMENT, title: 'Kerja Bakti', body: 'isi', publish: true }, meta);
    expect(repo.createPost).toHaveBeenCalledWith('rt1', expect.objectContaining({ status: AnnouncementStatus.PUBLISHED }), actor, meta);
  });

  it('de-duplicates slugs against the repository', async () => {
    const taken = new Set(['kerja-bakti']);
    const { repo, service } = buildService({ slugExists: vi.fn(async (_rtId: string, slug: string) => taken.has(slug)) });
    await service.createPost(actor, { type: ContentType.ANNOUNCEMENT, title: 'Kerja Bakti', body: 'isi' }, meta);
    expect(repo.createPost).toHaveBeenCalledWith('rt1', expect.objectContaining({ slug: 'kerja-bakti-2' }), actor, meta);
  });

  it('rejects an event that ends before it starts', async () => {
    const { service } = buildService();
    await expect(
      service.createPost(actor, { type: ContentType.ACTIVITY, title: 'Acara', body: 'isi', eventStartAt: '2026-06-10T00:00:00Z', eventEndAt: '2026-06-09T00:00:00Z' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when publishing a missing post', async () => {
    const { service } = buildService({ publishPost: vi.fn(async () => null) });
    await expect(service.publishPost(actor, 'missing', meta)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps an unknown public type path to 404', async () => {
    const { service } = buildService();
    await expect(service.getPublicPost('RT001', 'tidak-ada', 'slug')).rejects.toBeInstanceOf(NotFoundException);
  });
});
