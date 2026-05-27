/**
 * Purpose: Public transparency home page with unauthenticated aggregate report data.
 * Caller: Public App Router route at /.
 * Deps: Next metadata, public report API helpers, route parameter helpers, and public report components.
 * MainFuncs: Resolves public RT code safely and renders organization summary, cash balance, latest report, announcements, and CTAs.
 * SideEffects: Performs server-side public backend fetches without auth cookies or tenant headers.
 */
import type { Metadata } from 'next';
import { getPublicSummary, listPublicAnnouncements, listPublicReportMetadata } from '@/features/public-reports/api';
import { PublicHomeView, PublicTenantRequiredView } from '@/features/public-reports/components';
import { resolvePublicReportParams, type PublicSearchParams } from '@/features/public-reports/format';

export const metadata: Metadata = {
  title: 'Transparansi Publik',
  description: 'Ringkasan kas, laporan bulanan, dan pengumuman publik warga.',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<PublicSearchParams>;
};

export default async function PublicHomePage({ searchParams }: PageProps) {
  const { rtCode } = resolvePublicReportParams(await searchParams);
  if (!rtCode) {
    return <PublicTenantRequiredView />;
  }
  const [summary, reportFeed, announcementFeed] = await Promise.all([
    getPublicSummary(rtCode),
    listPublicReportMetadata(rtCode, { limit: 1 }),
    listPublicAnnouncements(rtCode, { limit: 3 }),
  ]);

  return <PublicHomeView summary={summary} latestReport={reportFeed.items[0]} announcements={announcementFeed.items} rtCode={rtCode} />;
}
