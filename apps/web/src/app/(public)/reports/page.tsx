/**
 * Purpose: Public finance summary and report feed page.
 * Caller: Public App Router route at /reports.
 * Deps: Next metadata, public report API helpers, route parameter helpers, and report view components.
 * MainFuncs: Renders cash balance, income/expense summary, monthly trend, category breakdown, collection CTA, and report feed.
 * SideEffects: Performs server-side public backend fetches without auth cookies or tenant headers.
 */
import type { Metadata } from 'next';
import { getPublicMonthlyFinance, getPublicMonthlyTrend, getPublicSummary, listPublicReportMetadata, publicMonthlyFinanceCsvHref, publicSummaryCsvHref } from '@/features/public-reports/api';
import { PublicReportsView, PublicTenantRequiredView } from '@/features/public-reports/components';
import { buildRecentMonths, resolvePublicReportParams, type PublicSearchParams } from '@/features/public-reports/format';

export const metadata: Metadata = {
  title: 'Laporan Publik',
  description: 'Ringkasan keuangan publik, tren bulanan, kategori, dan feed laporan.',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<PublicSearchParams>;
};

export default async function PublicReportsPage({ searchParams }: PageProps) {
  const { rtCode, month } = resolvePublicReportParams(await searchParams);
  if (!rtCode) {
    return <PublicTenantRequiredView />;
  }
  const trendMonths = buildRecentMonths(month, 6);
  const [summary, monthly, trend, reportFeed] = await Promise.all([
    getPublicSummary(rtCode),
    getPublicMonthlyFinance(rtCode, month),
    getPublicMonthlyTrend(rtCode, trendMonths),
    listPublicReportMetadata(rtCode, { limit: 5 }),
  ]);

  return <PublicReportsView summary={summary} monthly={monthly} trend={trend} latestReports={reportFeed.items} rtCode={rtCode} exportLinks={{ summary: publicSummaryCsvHref(rtCode), monthly: publicMonthlyFinanceCsvHref(rtCode, month) }} />;
}
