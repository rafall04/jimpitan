/**
 * Purpose: TanStack Query hooks for tenant-scoped content authoring + image mutations.
 * Caller: Content dashboard pages and forms.
 * Deps: TanStack Query, sonner toasts, tenant context, query keys, content API adapter + types.
 * MainFuncs: Loads paginated lists/detail/images and invalidates scoped caches after mutations.
 * SideEffects: Performs API calls, updates query cache, and shows non-sensitive toasts.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { queryKeys } from '@/lib/query/query-keys';
import {
  archiveContent,
  createContent,
  deleteContent,
  getContent,
  listContent,
  listContentImages,
  publishContent,
  removeContentImage,
  updateContent,
  uploadContentCover,
  uploadContentGalleryImage,
} from './api';
import type { ContentListParams, CreateContentPayload, UpdateContentPayload } from './types';

export function useContentListQuery(params: ContentListParams) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.content.list(activeTenantId, params) : ['content', 'disabled'],
    queryFn: () => listContent(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId),
  });
}

export function useContentQuery(postId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && postId ? queryKeys.content.detail(activeTenantId, postId) : ['content', 'detail', 'disabled'],
    queryFn: () => getContent(requiredTenant(activeTenantId), requiredId(postId)),
    enabled: Boolean(activeTenantId && postId),
  });
}

export function useContentImagesQuery(postId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && postId ? queryKeys.content.images(activeTenantId, postId) : ['content', 'images', 'disabled'],
    queryFn: () => listContentImages(requiredTenant(activeTenantId), requiredId(postId)),
    enabled: Boolean(activeTenantId && postId),
  });
}

export function useContentMutations(postId?: string) {
  const { activeTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const invalidateList = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.content.scope(requiredTenant(activeTenantId)) });
  };

  const invalidatePost = async () => {
    const tenantId = requiredTenant(activeTenantId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.content.scope(tenantId) }),
      postId ? queryClient.invalidateQueries({ queryKey: queryKeys.content.detail(tenantId, postId) }) : Promise.resolve(),
      postId ? queryClient.invalidateQueries({ queryKey: queryKeys.content.images(tenantId, postId) }) : Promise.resolve(),
    ]);
  };

  return {
    create: useMutation({
      mutationFn: (payload: CreateContentPayload) => createContent(requiredTenant(activeTenantId), payload),
      onSuccess: async () => {
        await invalidateList();
        toast.success('Konten dibuat');
      },
    }),
    update: useMutation({
      mutationFn: ({ id, payload }: { id: string; payload: UpdateContentPayload }) => updateContent(requiredTenant(activeTenantId), id, payload),
      onSuccess: async () => {
        await invalidatePost();
        toast.success('Konten diperbarui');
      },
    }),
    publish: useMutation({
      mutationFn: (id: string) => publishContent(requiredTenant(activeTenantId), id),
      onSuccess: async () => {
        await invalidatePost();
        toast.success('Konten diterbitkan');
      },
    }),
    archive: useMutation({
      mutationFn: (id: string) => archiveContent(requiredTenant(activeTenantId), id),
      onSuccess: async () => {
        await invalidatePost();
        toast.success('Konten diarsipkan');
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteContent(requiredTenant(activeTenantId), id),
      onSuccess: async () => {
        await invalidateList();
        toast.success('Konten dihapus');
      },
    }),
    uploadCover: useMutation({
      mutationFn: ({ id, file }: { id: string; file: File }) => uploadContentCover(requiredTenant(activeTenantId), id, file),
      onSuccess: async () => {
        await invalidatePost();
        toast.success('Foto sampul diunggah');
      },
    }),
    uploadGalleryImage: useMutation({
      mutationFn: ({ id, file }: { id: string; file: File }) => uploadContentGalleryImage(requiredTenant(activeTenantId), id, file),
      onSuccess: async () => {
        await invalidatePost();
        toast.success('Foto galeri ditambahkan');
      },
    }),
    removeImage: useMutation({
      mutationFn: ({ id, attachmentId }: { id: string; attachmentId: string }) => removeContentImage(requiredTenant(activeTenantId), id, attachmentId),
      onSuccess: async () => {
        await invalidatePost();
        toast.success('Foto dihapus');
      },
    }),
  };
}

function requiredTenant(activeTenantId: string | undefined): string {
  if (!activeTenantId) {
    throw new Error('RT aktif diperlukan.');
  }
  return activeTenantId;
}

function requiredId(id: string | null): string {
  if (!id) {
    throw new Error('ID konten diperlukan.');
  }
  return id;
}
