/**
 * Purpose: Shareable public monthly finance report page.
 * Caller: Public App Router route at /reports/monthly.
 * Deps: Next metadata, public report API helpers, route parameter helpers, and monthly report components.
 * MainFuncs: Resolves safe month filters and renders public monthly income, expense, net cash flow, and category table.
 * SideEffects: Performs server-side public backend fetches without auth cookies or tenant headers.
 */
import type { Metadata } from 'next';
import { getPublicMonthlyFinance, getPublicSummary, publicMonthlyFinanceCsvHref } from '@/features/public-reports/api';
import { PublicMonthlyReportView, PublicTenantRequiredView } from '@/features/public-reports/components';
import { resolvePublicReportParams, type PublicSearchParams } from '@/features/public-reports/format';

export const metadata: Metadata = {
  title: 'Laporan Bulanan Publik',
  description: 'Laporan bulanan publik yang dapat dibagikan dengan warga.',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<PublicSearchParams>;
};

export default async function PublicMonthlyReportPage({ searchParams }: PageProps) {
  const { rtCode, month } = resolvePublicReportParams(await searchParams);
  if (!rtCode) {
    return <PublicTenantRequiredView />;
  }
  const [summary, report] = await Promise.all([getPublicSummary(rtCode), getPublicMonthlyFinance(rtCode, month)]);

  return <PublicMonthlyReportView summary={summary} report={report} rtCode={rtCode} exportLinks={{ monthly: publicMonthlyFinanceCsvHref(rtCode, month) }} />;
}
