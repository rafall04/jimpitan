/**
 * Purpose: Edit-content page (form + image manager + publish/archive/delete lifecycle).
 * Caller: App Router /dashboard/content/[postId] route.
 * Deps: content form, image manager, badges, hooks, payload mapper, tenant permissions, Next navigation, toast.
 * MainFuncs: Loads a post, updates fields, manages images, and runs publish/archive/delete actions.
 * SideEffects: Performs content update/lifecycle/image mutations.
 */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/api-error';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { ContentStatusBadge, ContentTypeBadge } from '../components/content-badges';
import { ContentForm } from '../components/content-form';
import { ContentImageManager } from '../components/content-image-manager';
import { useContentMutations, useContentQuery } from '../hooks';
import { toUpdateContentPayload, type ContentFormValues } from '../schemas';

export function ContentEditPage({ postId }: { postId: string }) {
  const router = useRouter();
  const { permissions } = useTenantContext();
  const canEdit = permissions.has('content.update');
  const canPublish = permissions.has('content.publish');
  const canDelete = permissions.has('content.delete');
  const postQuery = useContentQuery(postId);
  const mutations = useContentMutations(postId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const post = postQuery.data;

  async function handleUpdate(values: ContentFormValues) {
    try {
      await mutations.update.mutateAsync({ id: postId, payload: toUpdateContentPayload(values) });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Gagal menyimpan perubahan.');
    }
  }

  async function runLifecycle(action: 'publish' | 'archive') {
    try {
      if (action === 'publish') await mutations.publish.mutateAsync(postId);
      else await mutations.archive.mutateAsync(postId);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Aksi gagal.');
    }
  }

  async function handleDelete() {
    try {
      await mutations.remove.mutateAsync(postId);
      router.push('/dashboard/content');
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Gagal menghapus konten.');
    }
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard/content"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Kembali ke daftar</Link>
      </Button>

      {postQuery.isPending ? <p className="text-sm text-muted-foreground">Memuat konten…</p> : null}
      {postQuery.isError ? (
        <section className="rounded-lg border bg-card p-4" role="alert">
          <p className="text-sm font-medium">Konten tidak ditemukan atau gagal dimuat.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void postQuery.refetch()}>Coba lagi</Button>
        </section>
      ) : null}

      {post ? (
        <>
          <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ContentTypeBadge type={post.type} />
                <ContentStatusBadge status={post.status} />
              </div>
              <h1 className="text-xl font-semibold">{post.title}</h1>
            </div>
            {canPublish ? (
              <div className="flex shrink-0 gap-2">
                {post.status !== 'PUBLISHED' ? (
                  <Button type="button" disabled={mutations.publish.isPending} onClick={() => void runLifecycle('publish')}>Terbitkan</Button>
                ) : (
                  <Button type="button" variant="outline" disabled={mutations.archive.isPending} onClick={() => void runLifecycle('archive')}>Arsipkan</Button>
                )}
              </div>
            ) : null}
          </header>

          <div className="rounded-lg border bg-card p-5">
            <ContentForm mode="edit" initial={post} isPending={mutations.update.isPending} onSubmit={(values) => handleUpdate(values)} onCancel={() => router.push('/dashboard/content')} />
          </div>

          <ContentImageManager postId={postId} canEdit={canEdit} />

          {canDelete ? (
            <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <h2 className="text-sm font-semibold text-destructive">Hapus konten</h2>
              <p className="mt-1 text-sm text-muted-foreground">Konten yang dihapus tidak lagi tampil di situs. Tindakan ini tidak dapat dibatalkan dari sini.</p>
              {confirmDelete ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Yakin ingin menghapus?</span>
                  <Button type="button" variant="destructive" size="sm" disabled={mutations.remove.isPending} onClick={() => void handleDelete()}>Ya, hapus</Button>
                  <Button type="button" variant="outline" size="sm" disabled={mutations.remove.isPending} onClick={() => setConfirmDelete(false)}>Batal</Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" className="mt-3 border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>Hapus konten</Button>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
