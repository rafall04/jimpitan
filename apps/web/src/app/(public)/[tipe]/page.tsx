/**
 * Purpose: Public content feed page for one category (kegiatan/pengumuman/artikel/galeri).
 * Caller: Public App Router route at /[tipe].
 * Deps: Next metadata + notFound, public content api, feed view, tenant-required view, public param resolver.
 * MainFuncs: Validates the category path, resolves the RT, fetches the published public feed, and renders it.
 * SideEffects: Performs server-side public backend fetches without auth cookies.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentTypeFromPath, listPublicContent, publicContentTypeLabel } from '@/features/public-content/api';
import { PublicContentFeedView } from '@/features/public-content/components';
import { PublicTenantRequiredView } from '@/features/public-reports/components';
import { resolvePublicReportParams, type PublicSearchParams } from '@/features/public-reports/format';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ tipe: string }>;
  searchParams?: Promise<PublicSearchParams>;
};

export async function generateMetadata({ params }: { params: Promise<{ tipe: string }> }): Promise<Metadata> {
  const { tipe } = await params;
  return { title: `${publicContentTypeLabel(tipe)} — JIMPITAN RT`, description: `Daftar ${publicContentTypeLabel(tipe).toLowerCase()} terbaru dari RT.` };
}

export default async function PublicContentFeedPage({ params, searchParams }: PageProps) {
  const { tipe } = await params;
  const type = contentTypeFromPath(tipe);
  if (!type) {
    notFound();
  }

  const rawParams = await searchParams;
  const { rtCode, search } = resolvePublicReportParams(rawParams);
  if (!rtCode) {
    return <PublicTenantRequiredView />;
  }

  const page = resolvePage(rawParams?.page);
  const feed = await listPublicContent(rtCode, { type, page, search: search || undefined }).catch(() => null);
  if (!feed) {
    return <PublicTenantRequiredView />;
  }

  return <PublicContentFeedView rtCode={rtCode} activePath={tipe} items={feed.items} page={feed.page} totalPages={feed.totalPages} search={search} />;
}

function resolvePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 999 ? parsed : 1;
}
