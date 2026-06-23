/**
 * Purpose: Server-rendered public content views (category nav, feed grid, post detail).
 * Caller: Public content App Router pages.
 * Deps: Next Link, Button, cn, public content api maps + image src, reaction bar, public date format.
 * MainFuncs: Renders a category-filtered feed of cards and a full post detail with gallery + reactions.
 * SideEffects: None (data is fetched by the calling page).
 */
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Heart, ImageIcon, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatIndonesianDate } from '@/features/public-reports/format';
import { PUBLIC_CONTENT_TYPES, publicContentImageSrc, publicContentTypeLabel } from './api';
import { ReactionBar } from './reaction-bar';
import type { PublicContentDetail, PublicContentItem } from './types';

function rtHref(path: string, rtCode: string): string {
  return `${path}?rt=${encodeURIComponent(rtCode)}`;
}

function formatEventWindow(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const formatter = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  const startLabel = formatter.format(new Date(start));
  if (!end) return startLabel;
  return `${startLabel} – ${formatter.format(new Date(end))}`;
}

export function PublicContentTypeNav({ rtCode, activePath }: { rtCode: string; activePath: string }) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Kategori konten">
      {PUBLIC_CONTENT_TYPES.map((entry) => (
        <Link
          key={entry.path}
          href={rtHref(`/${entry.path}`, rtCode)}
          aria-current={entry.path === activePath ? 'page' : undefined}
          className={cn(
            'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
            entry.path === activePath ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {entry.label}
        </Link>
      ))}
    </nav>
  );
}

export function PublicContentFeedView({
  rtCode,
  activePath,
  items,
  page,
  totalPages,
  search,
}: {
  rtCode: string;
  activePath: string;
  items: PublicContentItem[];
  page: number;
  totalPages: number;
  search?: string;
}) {
  const meta = PUBLIC_CONTENT_TYPES.find((entry) => entry.path === activePath);

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{meta?.label ?? 'Konten'}</h1>
        <p className="text-sm text-muted-foreground">{meta?.blurb ?? 'Kabar terbaru dari RT.'}</p>
      </header>
      <PublicContentTypeNav rtCode={rtCode} activePath={activePath} />

      {items.length === 0 ? (
        <section className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm font-medium">Belum ada {meta?.label.toLowerCase() ?? 'konten'}.</p>
          <p className="mt-1 text-sm text-muted-foreground">Konten akan tampil di sini setelah pengurus RT menerbitkannya.</p>
        </section>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article key={`${item.typePath}-${item.slug}`} className="flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md">
              <Link href={rtHref(`/${item.typePath}/${item.slug}`, rtCode)} className="flex h-full flex-col">
                <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-muted/40">
                  {item.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicContentImageSrc(item.coverImageUrl)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h2 className="font-semibold leading-snug">{item.title}</h2>
                  {item.excerpt ? <p className="line-clamp-3 text-sm text-muted-foreground">{item.excerpt}</p> : null}
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-muted-foreground">
                    {item.type === 'ACTIVITY' && item.eventStartAt ? (
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" aria-hidden="true" />{formatEventWindow(item.eventStartAt, null)}</span>
                    ) : item.publishedAt ? (
                      <span>{formatIndonesianDate(item.publishedAt)}</span>
                    ) : null}
                    {item.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{item.location}</span> : null}
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" aria-hidden="true" />{item.reactionCount}</span>
                  </div>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Halaman {page} dari {totalPages}</p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/${activePath}?rt=${encodeURIComponent(rtCode)}&page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}>Sebelumnya</Link>
              </Button>
            ) : null}
            {page < totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/${activePath}?rt=${encodeURIComponent(rtCode)}&page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ''}`}>Berikutnya</Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}

export function PublicContentDetailView({ rtCode, detail }: { rtCode: string; detail: PublicContentDetail }) {
  const eventWindow = detail.type === 'ACTIVITY' ? formatEventWindow(detail.eventStartAt, detail.eventEndAt) : null;

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href={rtHref(`/${detail.typePath}`, rtCode)}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{publicContentTypeLabel(detail.typePath)}</Link>
      </Button>

      <header className="space-y-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">{detail.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {detail.publishedAt ? <span>{formatIndonesianDate(detail.publishedAt)}</span> : null}
          {eventWindow ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden="true" />{eventWindow}</span> : null}
          {detail.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{detail.location}</span> : null}
        </div>
      </header>

      {detail.coverImageUrl ? (
        <div className="overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={publicContentImageSrc(detail.coverImageUrl)} alt="" className="w-full object-cover" />
        </div>
      ) : null}

      {detail.body ? <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{detail.body}</div> : null}

      {detail.images.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Galeri foto</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {detail.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={image.url} src={publicContentImageSrc(image.url)} alt={image.fileName} className="aspect-square w-full rounded-md border object-cover" />
            ))}
          </div>
        </section>
      ) : null}

      <ReactionBar rtCode={rtCode} typePath={detail.typePath} slug={detail.slug} initialBreakdown={detail.reactionBreakdown} initialCount={detail.reactionCount} />
    </main>
  );
}
