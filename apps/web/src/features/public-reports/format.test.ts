/**
 * Purpose: Unit tests for public transparency formatting and safe route parameter helpers.
 * Caller: Vitest test runner.
 * Deps: Public report format helpers.
 * MainFuncs: Verifies IDR/date formatting, month windows, public RT parameter handling, and phone redaction.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { buildRecentMonths, formatIdr, formatIndonesianDate, resolvePublicReportParams, sanitizePublicCopy } from './format';

describe('public report formatting', () => {
  it('formats public money and dates for Indonesian readers', () => {
    expect(formatIdr('12500')).toBe('Rp12.500');
    expect(formatIndonesianDate('2026-05-26T10:00:00.000Z')).toContain('26 Mei 2026');
  });

  it('resolves safe shareable public report parameters', () => {
    expect(
      resolvePublicReportParams(
        { rt: 'RT-007', month: '2026-04', search: 'iuran' },
        { defaultRtCode: 'RT001', now: new Date('2026-05-26T00:00:00.000Z') },
      ),
    ).toEqual({ rtCode: 'RT-007', month: '2026-04', search: 'iuran' });
  });

  it('does not fall back to a hardcoded RT when no safe public tenant exists', () => {
    expect(resolvePublicReportParams({}, { defaultRtCode: '', now: new Date('2026-05-26T00:00:00.000Z') })).toEqual({
      rtCode: undefined,
      month: '2026-05',
      search: '',
    });
  });

  it('falls back from invalid public filters without passing unsafe input to APIs', () => {
    expect(resolvePublicReportParams({ rt: '../secret', month: '2026-99' }, { defaultRtCode: 'RT001', now: new Date('2026-05-26T00:00:00.000Z') })).toEqual({
      rtCode: 'RT001',
      month: '2026-05',
      search: '',
    });
  });

  it('builds a bounded recent-month trend window', () => {
    expect(buildRecentMonths('2026-05', 4)).toEqual(['2026-02', '2026-03', '2026-04', '2026-05']);
  });

  it('redacts phone-like public copy before rendering', () => {
    expect(sanitizePublicCopy('Kontak WA 081234567890 untuk detail.')).not.toContain('081234567890');
  });
});
