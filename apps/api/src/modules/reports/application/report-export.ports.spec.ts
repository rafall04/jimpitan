/**
 * Purpose: Unit tests for report CSV export foundation.
 * Caller: Vitest test runner.
 * Deps: CsvReportSerializer.
 * MainFuncs: Verifies deterministic CSV escaping for future export workers.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { CsvReportSerializer } from './report-export.ports';

describe('CsvReportSerializer', () => {
  it('escapes commas, quotes, newlines, and null cells deterministically', () => {
    const csv = new CsvReportSerializer().serialize({
      headers: ['name', 'amount', 'note'],
      rows: [['Kas, Utama', 10000, 'He said "ok"'], ['Line', null, 'a\nb']],
    });

    expect(csv).toBe('name,amount,note\n"Kas, Utama",10000,"He said ""ok"""\nLine,,"a\nb"');
  });

  it('neutralizes spreadsheet formula injection in string cells and headers', () => {
    const csv = new CsvReportSerializer().serialize({
      headers: ['=cmd', 'amount'],
      rows: [['+SUM(1,1)', 10000], ['@HYPERLINK("http://evil")', 1]],
    });

    expect(csv).toBe(`'=cmd,amount\n"'+SUM(1,1)",10000\n"'@HYPERLINK(""http://evil"")",1`);
  });
});
