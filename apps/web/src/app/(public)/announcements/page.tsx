/**
 * Purpose: Public announcement feed page.
 * Caller: Public App Router route at /announcements.
 * Deps: Next metadata, public report API helpers, route parameter helpers, and announcement components.
 * MainFuncs: Renders searchable public announcements with safe RT resolution and pagination links.
 * SideEffects: Performs server-side public backend fetches without auth cookies or tenant headers.
 */
import type { Metadata } from 'next';
import { getPublicSummary, listPublicAnnouncements } from '@/features/public-reports/api';
import { PublicAnnouncementsView, PublicTenantRequiredView } from '@/features/public-reports/components';
import { resolvePublicReportParams, type PublicSearchParams } from '@/features/public-reports/format';

export const metadata: Metadata = {
  title: 'Pengumuman Publik',
  description: 'Feed pengumuman publik warga.',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<PublicSearchParams>;
};

export default async function PublicAnnouncementsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const { rtCode, search } = resolvePublicReportParams(rawParams);
  if (!rtCode) {
    return <PublicTenantRequiredView />;
  }
  const page = resolvePublicPage(rawParams?.page);
  const [summary, announcementFeed] = await Promise.all([getPublicSummary(rtCode), listPublicAnnouncements(rtCode, { page, limit: 10, search })]);

  return <PublicAnnouncementsView summary={summary} announcements={announcementFeed.items} pagination={announcementFeed} rtCode={rtCode} search={search} />;
}

function resolvePublicPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 999 ? parsed : 1;
}
