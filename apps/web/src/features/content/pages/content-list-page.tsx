/**
 * Purpose: Tenant-aware content list/management page.
 * Caller: App Router /dashboard/content route.
 * Deps: content hooks, badges, format helpers, tenant permissions, Next Link, toast.
 * MainFuncs: Filters by type/status/search, lists posts as cards, and runs quick publish/archive actions.
 * SideEffects: Performs tenant-scoped content API calls through TanStack Query hooks.
 */
'use client';

import Link from 'next/link';
import { Eye, Heart, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ApiError } from '@/lib/api/api-error';
import { cn } from '@/lib/utils/cn';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { ContentStatusBadge, ContentTypeBadge } from '../components/content-badges';
import { contentImageSrc, formatDateTime } from '../format';
import { useContentListQuery, useContentMutations } from '../hooks';
import { CONTENT_TYPE_OPTIONS } from '../schemas';
import type { ContentListParams, ContentListRow, ContentStatus, ContentType } from '../types';

export function ContentListPage() {
  const { permissions } = useTenantContext();
  const canCreate = permissions.has('content.create');
  const canPublish = permissions.has('content.publish');
  const [type, setType] = useState<ContentType | ''>('');
  const [status, setStatus] = useState<ContentStatus | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const mutations = useContentMutations();

  const params = useMemo<ContentListParams>(
    () => ({ page, limit: 12, type: type || undefined, status: status || undefined, search: search || undefined }),
    [page, type, status, search],
  );
  const listQuery = useContentListQuery(params);

  async function runLifecycle(action: 'publish' | 'archive', row: ContentListRow) {
    try {
      if (action === 'publish') await mutations.publish.mutateAsync(row.id);
      else await mutations.archive.mutateAsync(row.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Aksi gagal.');
    }
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Konten RT</h1>
          <p className="text-sm text-muted-foreground">Kelola pengumuman, kegiatan, artikel, dan galeri foto yang tampil di situs publik RT.</p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/content/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Buat konten
            </Link>
          </Button>
        ) : null}
      </header>

      <section className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_11rem_11rem]">
        <div className="space-y-1">
          <label htmlFor="content-search" className="text-xs font-medium text-muted-foreground">Cari judul</label>
          <Input id="content-search" placeholder="Cari konten…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1">
          <label htmlFor="content-type-filter" className="text-xs font-medium text-muted-foreground">Jenis</label>
          <Select id="content-type-filter" value={type} onChange={(event) => { setType(event.target.value as ContentType | ''); setPage(1); }}>
            <option value="">Semua jenis</option>
            {CONTENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label htmlFor="content-status-filter" className="text-xs font-medium text-muted-foreground">Status</label>
          <Select id="content-status-filter" value={status} onChange={(event) => { setStatus(event.target.value as ContentStatus | ''); setPage(1); }}>
            <option value="">Semua status</option>
            <option value="DRAFT">Draf</option>
            <option value="PUBLISHED">Terbit</option>
            <option value="ARCHIVED">Arsip</option>
          </Select>
        </div>
      </section>

      {listQuery.isPending ? <p className="text-sm text-muted-foreground">Memuat konten…</p> : null}
      {listQuery.isError ? (
        <section className="rounded-lg border bg-card p-4" role="alert">
          <p className="text-sm font-medium">Konten gagal dimuat.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void listQuery.refetch()}>Coba lagi</Button>
        </section>
      ) : null}

      {listQuery.data ? (
        listQuery.data.items.length === 0 ? (
          <EmptyState title="Belum ada konten" description="Buat pengumuman atau kegiatan pertama agar situs RT terlihat aktif." />
        ) : (
          <div className="space-y-3">
            {listQuery.data.items.map((row) => (
              <article key={row.id} className="flex gap-4 rounded-lg border bg-card p-4">
                <div className="hidden h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40 sm:flex">
                  {row.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contentImageSrc(row.coverImage.url)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Tanpa foto</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ContentTypeBadge type={row.type} />
                    <ContentStatusBadge status={row.status} />
                  </div>
                  <h2 className="mt-2 truncate font-semibold">
                    <Link href={`/dashboard/content/${row.id}`} className="hover:underline">{row.title}</Link>
                  </h2>
                  {row.excerpt ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{row.excerpt}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>{row.publishedAt ? `Terbit ${formatDateTime(row.publishedAt)}` : `Dibuat ${formatDateTime(row.createdAt)}`}</span>
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" aria-hidden="true" />{row.reactionCount}</span>
                    <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" aria-hidden="true" />{row.viewCount}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Button asChild variant="ghost" size="icon" aria-label={`Edit ${row.title}`}>
                    <Link href={`/dashboard/content/${row.id}`}><Pencil className="h-4 w-4" aria-hidden="true" /></Link>
                  </Button>
                  {canPublish && row.status !== 'PUBLISHED' ? (
                    <Button type="button" variant="outline" size="sm" disabled={mutations.publish.isPending} onClick={() => void runLifecycle('publish', row)}>Terbitkan</Button>
                  ) : null}
                  {canPublish && row.status === 'PUBLISHED' ? (
                    <Button type="button" variant="outline" size="sm" disabled={mutations.archive.isPending} onClick={() => void runLifecycle('archive', row)}>Arsipkan</Button>
                  ) : null}
                </div>
              </article>
            ))}

            <div className={cn('flex items-center justify-between pt-2', listQuery.data.totalPages <= 1 && 'hidden')}>
              <p className="text-sm text-muted-foreground">Halaman {listQuery.data.page} dari {listQuery.data.totalPages} · {listQuery.data.total} konten</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Sebelumnya</Button>
                <Button type="button" variant="outline" size="sm" disabled={page >= listQuery.data.totalPages} onClick={() => setPage((value) => value + 1)}>Berikutnya</Button>
              </div>
            </div>
          </div>
        )
      ) : null}
    </main>
  );
}
