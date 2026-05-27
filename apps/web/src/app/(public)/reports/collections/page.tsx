/**
 * Purpose: Public collection summary page derived from public-safe monthly finance categories.
 * Caller: Public App Router route at /reports/collections.
 * Deps: Next metadata, public report API helpers, route parameter helpers, and collection report components.
 * MainFuncs: Renders aggregate collection-like income categories without resident, phone, note, or outstanding detail.
 * SideEffects: Performs server-side public backend fetches without auth cookies or tenant headers.
 */
import type { Metadata } from 'next';
import { getPublicMonthlyFinance, getPublicSummary, publicCollectionsCsvHref } from '@/features/public-reports/api';
import { PublicCollectionsView, PublicTenantRequiredView } from '@/features/public-reports/components';
import { resolvePublicReportParams, type PublicSearchParams } from '@/features/public-reports/format';

export const metadata: Metadata = {
  title: 'Ringkasan Koleksi Publik',
  description: 'Ringkasan koleksi publik berbasis kategori pemasukan yang aman dibagikan.',
};

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: Promise<PublicSearchParams>;
};

export default async function PublicCollectionsReportPage({ searchParams }: PageProps) {
  const { rtCode, month } = resolvePublicReportParams(await searchParams);
  if (!rtCode) {
    return <PublicTenantRequiredView />;
  }
  const [summary, report] = await Promise.all([getPublicSummary(rtCode), getPublicMonthlyFinance(rtCode, month)]);

  return <PublicCollectionsView summary={summary} report={report} rtCode={rtCode} exportLinks={{ collections: publicCollectionsCsvHref(rtCode, month) }} />;
}
