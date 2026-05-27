/**
 * Purpose: Server-render smoke tests for public transparency page components.
 * Caller: Vitest test runner.
 * Deps: React DOM server and public report presentation components.
 * MainFuncs: Verifies public page rendering, empty states, safe redaction, and mobile-first class anchors.
 * SideEffects: None.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PublicAnnouncementsView, PublicCollectionsView, PublicHomeView, PublicMonthlyReportView, PublicReportsView, PublicRouteLoadingSkeleton, PublicTenantRequiredView } from './components';
import type { PublicAnnouncement, PublicMonthlyFinanceReport, PublicReportMetadata, PublicTransparencySummary } from './types';

const summary: PublicTransparencySummary = {
  rt: { code: 'RT001', name: 'RT Sejahtera' },
  cashBalance: { totalBalance: '1500000', currency: 'IDR', accountCount: 2 },
  totals: { income: '500000', expense: '125000', netCashFlow: '375000' },
  currentMonth: '2026-05',
  lastUpdatedAt: '2026-05-26T10:00:00.000Z',
};

const monthly: PublicMonthlyFinanceReport = {
  month: '2026-05',
  totals: { income: '500000', expense: '125000', netCashFlow: '375000' },
  categorySummaries: [
    { categoryKey: 'jimpitan-rutin', categoryName: 'Jimpitan Rutin', type: 'INCOME', total: '350000', direction: 'INCREASE' },
    { categoryKey: 'kebersihan', categoryName: 'Kebersihan', type: 'EXPENSE', total: '125000', direction: 'DECREASE' },
  ],
  generatedAt: '2026-05-26T10:00:00.000Z',
};

const latestReport: PublicReportMetadata = {
  id: 'report-1',
  title: 'Laporan Mei 2026',
  type: 'ANNOUNCEMENT',
  publishedAt: '2026-05-26T08:00:00.000Z',
};

const announcement: PublicAnnouncement = {
  id: 'announcement-1',
  title: 'Pengumuman Kas Mei',
  body: 'Saldo sudah diperbarui. Hubungi 081234567890 untuk pertanyaan.',
  publishedAt: '2026-05-26T08:00:00.000Z',
};

describe('public report components', () => {
  it('renders the public home with organization, totals, latest report, announcements, and safe copy', () => {
    const html = renderToStaticMarkup(<PublicHomeView summary={summary} latestReport={latestReport} announcements={[announcement]} rtCode="RT001" />);

    expect(html).toContain('RT Sejahtera');
    expect(html).toContain('Rp1.500.000');
    expect(html).toContain('Laporan Mei 2026');
    expect(html).toContain('Pengumuman Kas Mei');
    expect(html).not.toContain('081234567890');
  });

  it('renders the report summary with mobile-first layout anchors and accessible tables', () => {
    const html = renderToStaticMarkup(<PublicReportsView summary={summary} monthly={monthly} trend={[monthly]} latestReports={[latestReport]} rtCode="RT001" exportLinks={{ summary: 'https://api.example.test/summary.csv' }} />);

    expect(html).toContain('Ringkasan Keuangan Publik');
    expect(html).toContain('grid-cols-1');
    expect(html).toContain('<table');
    expect(html).toContain('Tren 6 bulan');
    expect(html).toContain('Unduh ringkasan CSV');
  });

  it('renders a filtered monthly report link and empty category state', () => {
    const emptyMonthly = { ...monthly, month: '2026-04', categorySummaries: [] };
    const html = renderToStaticMarkup(<PublicMonthlyReportView summary={summary} report={emptyMonthly} rtCode="RT001" exportLinks={{ monthly: 'https://api.example.test/monthly.csv' }} />);

    expect(html).toContain('value="2026-04"');
    expect(html).toContain('/reports/monthly?rt=RT001&amp;month=2026-04');
    expect(html).toContain('Belum ada rincian kategori');
    expect(html).toContain('Unduh laporan CSV');
  });

  it('renders collection income summaries without outstanding resident detail', () => {
    const html = renderToStaticMarkup(<PublicCollectionsView summary={summary} report={monthly} rtCode="RT001" exportLinks={{ collections: 'https://api.example.test/collections.csv' }} />);

    expect(html).toContain('Ringkasan Koleksi');
    expect(html).toContain('Jimpitan Rutin');
    expect(html).toContain('Ringkasan tunggakan belum dipublikasikan');
    expect(html).toContain('Unduh koleksi CSV');
    expect(html).not.toContain('resident');
    expect(html).not.toContain('phone');
  });

  it('does not count unrelated income categories as collection totals', () => {
    const unrelated = {
      ...monthly,
      categorySummaries: [{ categoryKey: 'donasi-umum', categoryName: 'Donasi Umum', type: 'INCOME' as const, total: '350000', direction: 'INCREASE' as const }],
    };
    const html = renderToStaticMarkup(<PublicCollectionsView summary={summary} report={unrelated} rtCode="RT001" />);

    expect(html).toContain('Rp0');
    expect(html).toContain('Belum ada kategori koleksi');
    expect(html).not.toContain('Donasi Umum');
  });

  it('renders announcement empty and loading states', () => {
    const emptyHtml = renderToStaticMarkup(<PublicAnnouncementsView summary={summary} announcements={[]} pagination={{ page: 1, limit: 10, total: 0, totalPages: 0 }} rtCode="RT001" search="" />);
    const loadingHtml = renderToStaticMarkup(<PublicRouteLoadingSkeleton label="Memuat laporan publik" />);

    expect(emptyHtml.match(/Belum ada pengumuman publik/g)).toHaveLength(1);
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain('id="main-content"');
  });

  it('renders a safe empty state when no public RT code is configured', () => {
    const html = renderToStaticMarkup(<PublicTenantRequiredView />);

    expect(html).toContain('Kode RT publik belum dikonfigurasi');
    expect(html).toContain('id="main-content"');
  });
});
