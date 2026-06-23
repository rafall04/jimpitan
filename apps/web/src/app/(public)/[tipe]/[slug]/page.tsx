/**
 * Purpose: Public content detail page for one post (by category + slug).
 * Caller: Public App Router route at /[tipe]/[slug].
 * Deps: Next metadata + notFound, public content api, detail view, tenant-required view, public param resolver.
 * MainFuncs: Validates the category, resolves the RT, fetches the published post, and renders detail + reactions.
 * SideEffects: Performs server-side public backend fetches without auth cookies.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { contentTypeFromPath, getPublicContent } from '@/features/public-content/api';
import { PublicContentDetailView } from '@/features/public-content/components';
import { PublicTenantRequiredView } from '@/features/public-reports/components';
import { resolvePublicReportParams, type PublicSearchParams } from '@/features/public-reports/format';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ tipe: string; slug: string }>;
  searchParams?: Promise<PublicSearchParams>;
};

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { tipe, slug } = await params;
  if (!contentTypeFromPath(tipe)) {
    return { title: 'Konten tidak ditemukan' };
  }
  const { rtCode } = resolvePublicReportParams(await searchParams);
  if (!rtCode) {
    return { title: 'Konten RT' };
  }
  const detail = await getPublicContent(rtCode, tipe, slug).catch(() => null);
  return { title: detail ? detail.title : 'Konten tidak ditemukan', description: detail?.excerpt ?? undefined };
}

export default async function PublicContentDetailPage({ params, searchParams }: PageProps) {
  const { tipe, slug } = await params;
  if (!contentTypeFromPath(tipe)) {
    notFound();
  }

  const { rtCode } = resolvePublicReportParams(await searchParams);
  if (!rtCode) {
    return <PublicTenantRequiredView />;
  }

  const detail = await getPublicContent(rtCode, tipe, slug).catch(() => null);
  if (!detail) {
    notFound();
  }

  return <PublicContentDetailView rtCode={rtCode} detail={detail} />;
}
