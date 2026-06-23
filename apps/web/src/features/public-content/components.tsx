/**
 * Purpose: Server-rendered public content views (category nav, content card, feed grid, home section, post detail).
 * Caller: Public content + public home App Router pages.
 * Deps: Next Link, Button, cn, public content api maps + image src, reaction bar, public date format.
 * MainFuncs: Renders reusable content cards, a category-filtered feed, a home "latest" section, and a post detail.
 * SideEffects: None (data is fetched by the calling page).
 */
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Heart, ImageIcon, MapPin, Megaphone, Newspaper, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatIndonesianDate } from '@/features/public-reports/format';
import { PUBLIC_CONTENT_TYPES, publicContentImageSrc, publicContentTypeLabel } from './api';
import { ReactionBar } from './reaction-bar';
import type { ContentType, PublicContentDetail, PublicContentItem } from './types';

const COVER_GRADIENT: Record<ContentType, string> = {
  ACTIVITY: 'linear-gradient(135deg, #1e6f4e, #2f9d6b)',
  GALLERY: 'linear-gradient(135deg, #b45309, #f59e0b)',
  ARTICLE: 'linear-gradient(135deg, #134e3a, #15803d)',
  ANNOUNCEMENT: 'linear-gradient(135deg, #0f5132, #198754)',
};

const COVER_ICON: Record<ContentType, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  ACTIVITY: Users,
  GALLERY: ImageIcon,
  ARTICLE: Newspaper,
  ANNOUNCEMENT: Megaphone,
};

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
      {PUBLIC_CONTENT_TYPES.map((entry) => {
        const active = entry.path === activePath;
        return (
          <Link
            key={entry.path}
            href={rtHref(`/${entry.path}`, rtCode)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}

function ContentCover({ item, className }: { item: { type: ContentType; coverImageUrl: string | null }; className?: string }) {
  const Icon = COVER_ICON[item.type];
  if (item.coverImageUrl) {
    return (
      <div className={cn('overflow-hidden bg-muted', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={publicContentImageSrc(item.coverImageUrl)} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      </div>
    );
  }
  return (
    <div className={cn('flex items-center justify-center', className)} style={{ background: COVER_GRADIENT[item.type] }}>
      <Icon className="h-9 w-9 text-white/85" aria-hidden={true} />
    </div>
  );
}

export function PublicContentCard({ rtCode, item }: { rtCode: string; item: PublicContentItem }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link href={rtHref(`/${item.typePath}/${item.slug}`, rtCode)} className="flex h-full flex-col">
        <div className="relative">
          <ContentCover item={item} className="aspect-[16/9]" />
          <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-semibold text-foreground backdrop-blur-sm">
            {publicContentTypeLabel(item.typePath)}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-5">
          <h3 className="font-bold leading-snug tracking-tight">{item.title}</h3>
          {item.excerpt ? <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{item.excerpt}</p> : null}
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs font-medium text-muted-foreground">
            {item.type === 'ACTIVITY' && item.eventStartAt ? (
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{formatEventWindow(item.eventStartAt, null)}</span>
            ) : item.publishedAt ? (
              <span>{formatIndonesianDate(item.publishedAt)}</span>
            ) : null}
            {item.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{item.location}</span> : null}
            <span className="ml-auto inline-flex items-center gap-1.5 text-gold"><Heart className="h-3.5 w-3.5" aria-hidden="true" />{item.reactionCount}</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function PublicLatestContent({ rtCode, items }: { rtCode: string; items: PublicContentItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Kabar RT</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Yang terbaru di lingkungan kita</h2>
        </div>
        <PublicContentTypeNav rtCode={rtCode} activePath="" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 6).map((item) => (
          <PublicContentCard key={`${item.typePath}-${item.slug}`} rtCode={rtCode} item={item} />
        ))}
      </div>
    </section>
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
    <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Kabar RT</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{meta?.label ?? 'Konten'}</h1>
        <p className="max-w-2xl text-base text-muted-foreground">{meta?.blurb ?? 'Kabar terbaru dari lingkungan kita.'}</p>
      </header>
      <PublicContentTypeNav rtCode={rtCode} activePath={activePath} />

      {items.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-xl border bg-card p-12 text-center shadow-sm">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Megaphone className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="font-semibold">Belum ada {meta?.label.toLowerCase() ?? 'konten'}</p>
          <p className="mt-1 text-sm text-muted-foreground">Konten akan tampil di sini setelah pengurus RT menerbitkannya.</p>
        </section>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <PublicContentCard key={`${item.typePath}-${item.slug}`} rtCode={rtCode} item={item} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t pt-5">
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
    <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground">
        <Link href={rtHref(`/${detail.typePath}`, rtCode)}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{publicContentTypeLabel(detail.typePath)}</Link>
      </Button>

      <header className="space-y-3">
        <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{publicContentTypeLabel(detail.typePath)}</span>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{detail.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-muted-foreground">
          {detail.publishedAt ? <span>{formatIndonesianDate(detail.publishedAt)}</span> : null}
          {eventWindow ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden="true" />{eventWindow}</span> : null}
          {detail.location ? <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden="true" />{detail.location}</span> : null}
        </div>
      </header>

      {detail.coverImageUrl ? (
        <div className="overflow-hidden rounded-xl border shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={publicContentImageSrc(detail.coverImageUrl)} alt="" className="max-h-[420px] w-full object-cover" />
        </div>
      ) : null}

      {detail.body ? <div className="whitespace-pre-wrap text-base leading-7 text-foreground/90">{detail.body}</div> : null}

      {detail.images.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Galeri foto</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {detail.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={image.url} src={publicContentImageSrc(image.url)} alt={image.fileName} className="aspect-square w-full rounded-lg border object-cover" />
            ))}
          </div>
        </section>
      ) : null}

      <ReactionBar rtCode={rtCode} typePath={detail.typePath} slug={detail.slug} initialBreakdown={detail.reactionBreakdown} initialCount={detail.reactionCount} />
    </main>
  );
}
