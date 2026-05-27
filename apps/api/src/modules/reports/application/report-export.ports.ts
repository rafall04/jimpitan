/**
 * Purpose: Export-ready interfaces and CSV serialization foundation for report export workers.
 * Caller: Future report export queue workers and provider adapters.
 * Deps: None.
 * MainFuncs: Defines queue/PDF/Excel ports and a deterministic CSV serializer for tabular report payloads.
 * SideEffects: None.
 */
export type ReportExportTable = {
  headers: string[];
  rows: Array<Array<string | number | boolean | null>>;
};

export type ReportExportJob = {
  exportId: string;
  rtId: string;
  reportType: string;
  format: 'CSV' | 'PDF' | 'EXCEL';
  filters: Record<string, unknown>;
};

export interface ReportExportQueuePort {
  enqueue(job: ReportExportJob): Promise<void>;
}

export interface ReportPdfGeneratorPort {
  generatePdf(table: ReportExportTable): Promise<Buffer>;
}

export interface ReportExcelGeneratorPort {
  generateWorkbook(table: ReportExportTable): Promise<Buffer>;
}

export class CsvReportSerializer {
  serialize(table: ReportExportTable): string {
    return [table.headers, ...table.rows].map((row) => row.map((cell) => this.escapeCell(cell)).join(',')).join('\n');
  }

  private escapeCell(value: string | number | boolean | null): string {
    if (value === null) {
      return '';
    }
    const text = typeof value === 'string' ? this.neutralizeFormula(value) : String(value);
    if (!/[",\n\r]/.test(text)) {
      return text;
    }
    return `"${text.replaceAll('"', '""')}"`;
  }

  private neutralizeFormula(value: string): string {
    return /^\s*[=+\-@]/.test(value) || /^[\t\r]/.test(value) ? `'${value}` : value;
  }
}
