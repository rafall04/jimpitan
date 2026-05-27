/**
 * Purpose: Application service for private ledger-derived reports, public transparency reads, and export lifecycle orchestration.
 * Caller: ReportsController and future export workers.
 * Deps: Reports repository port, Nest exceptions, AuthPrincipal, reporting commands and types.
 * MainFuncs: Validates date ranges, enforces tenant delegation, strips public unsafe fields, creates exports, generates CSV, and serves downloads.
 * SideEffects: Writes report export/audit rows through repository on export creation, status changes, retries, and downloads.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ReportExportFormat } from '@prisma/client';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { REPORTS_REPOSITORY } from '../reports.tokens';
import type {
  ApprovalActivityReportQuery,
  AuditActivityReportQuery,
  CollectionReportQuery,
  CreateReportExportCommand,
  ExpenseCategoryReportQuery,
  FinanceReportQuery,
  OutstandingReportQuery,
  ProcessReportExportsCommand,
  PublicFeedQuery,
  PublicMonthlyFinanceQuery,
  ReportExportListQuery,
  ReportRequestMeta,
  ReportType,
} from './reports.commands';
import type {
  ApprovalActivityReport,
  AreaProgressReportItem,
  AuditActivityReport,
  CashFlowSummaryReport,
  CollectionPerformanceReport,
  ExpenseCategoryBreakdownReport,
  FinanceSummaryReport,
  OutstandingHouseReportItem,
  PublicAnnouncement,
  PublicMonthlyFinanceReport,
  PublicReportMetadata,
  PublicTransparencySummary,
  ReportExportDownload,
  ReportExportFileMetadata,
  ReportExportProcessingResult,
  ReportExportRecord,
} from '../domain/reports.types';
import type { ReportsRepositoryPort } from '../infrastructure/reports.repository.port';
import { CsvReportSerializer, type ReportExportTable } from './report-export.ports';
import { ReportExportEngine } from './report-export.engine';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const RT_CODE_PATTERN = /^[A-Za-z0-9_-]{2,40}$/;
const MAX_RANGE_DAYS = 366;
const MAX_EXPORT_FILTER_BYTES = 8_192;
const MAX_EXPORT_FILTER_DEPTH = 6;
const EXPORT_EXPIRATION_DAYS = 7;
const UNSAFE_JSON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PRIVATE_ONLY_EXPORT_TYPES = new Set<ReportType>(['LEDGER_EXPORT', 'TRANSACTION_EXPORT', 'APPROVAL_ACTIVITY', 'AUDIT_ACTIVITY']);
const PUBLIC_SAFE_EXPORT_TYPES = new Set<ReportType>(['PUBLIC_TRANSPARENCY_SUMMARY', 'PUBLIC_MONTHLY_FINANCE']);

@Injectable()
export class ReportsService {
  private readonly exportEngine = new ReportExportEngine();
  private readonly csvSerializer = new CsvReportSerializer();

  constructor(@Inject(REPORTS_REPOSITORY) private readonly repository: ReportsRepositoryPort) {}

  async getFinanceSummary(actor: AuthPrincipal, query: FinanceReportQuery): Promise<FinanceSummaryReport> {
    return this.repository.getFinanceSummary(actor.rtId, this.normalizeDateRange(query));
  }

  async getCollectionPerformance(actor: AuthPrincipal, query: CollectionReportQuery): Promise<CollectionPerformanceReport> {
    return this.repository.getCollectionPerformance(actor.rtId, this.normalizeDateRange(query));
  }

  async getOutstandingHouses(actor: AuthPrincipal, query: OutstandingReportQuery): Promise<PaginatedResult<OutstandingHouseReportItem>> {
    return this.repository.getOutstandingHouses(actor.rtId, this.normalizeDateRange(query));
  }

  async getPerAreaProgress(actor: AuthPrincipal, query: CollectionReportQuery): Promise<AreaProgressReportItem[]> {
    return this.repository.getPerAreaProgress(actor.rtId, this.normalizeDateRange(query));
  }

  async getExpenseCategoryBreakdown(actor: AuthPrincipal, query: ExpenseCategoryReportQuery): Promise<ExpenseCategoryBreakdownReport> {
    return this.repository.getExpenseCategoryBreakdown(actor.rtId, this.normalizeDateRange(query));
  }

  async getCashFlowSummary(actor: AuthPrincipal, query: FinanceReportQuery): Promise<CashFlowSummaryReport> {
    return this.repository.getCashFlowSummary(actor.rtId, this.normalizeDateRange(query));
  }

  async getApprovalActivity(actor: AuthPrincipal, query: ApprovalActivityReportQuery): Promise<ApprovalActivityReport> {
    return this.repository.getApprovalActivity(actor.rtId, this.normalizeDateRange(query));
  }

  async getAuditActivity(actor: AuthPrincipal, query: AuditActivityReportQuery): Promise<AuditActivityReport> {
    return this.repository.getAuditActivity(actor.rtId, this.normalizeDateRange(query));
  }

  async createExport(actor: AuthPrincipal, command: CreateReportExportCommand, meta: ReportRequestMeta): Promise<ReportExportRecord> {
    if (!Object.values(ReportExportFormat).includes(command.format)) {
      throw new BadRequestException('Unsupported report export format.');
    }
    const normalized = this.normalizeExportCommand(command);
    const record = await this.repository.createExportRequest(actor.rtId, normalized, actor, meta);
    if (normalized.format !== ReportExportFormat.CSV || record.status !== 'PENDING' || record.objectKey) {
      return record;
    }
    return this.processCsvExport(actor, record, meta);
  }

  async listExports(actor: AuthPrincipal, query: ReportExportListQuery): Promise<PaginatedResult<ReportExportRecord>> {
    await this.repository.expireExports(actor.rtId, new Date());
    return this.repository.listExportRequests(actor.rtId, query);
  }

  async getExport(actor: AuthPrincipal, exportId: string): Promise<ReportExportRecord> {
    await this.repository.expireExports(actor.rtId, new Date());
    const record = await this.repository.findExportRequestById(actor.rtId, exportId);
    if (!record) {
      throw new NotFoundException('Report export was not found.');
    }
    return record;
  }

  async downloadExport(actor: AuthPrincipal, exportId: string, meta: ReportRequestMeta): Promise<ReportExportDownload> {
    await this.repository.expireExports(actor.rtId, new Date());
    const record = await this.getExport(actor, exportId);
    if (record.status === 'EXPIRED' || (record.expiresAt && record.expiresAt.getTime() <= Date.now())) {
      throw new BadRequestException('Report export has expired.');
    }
    if (record.status !== 'COMPLETED') {
      throw new BadRequestException('Report export is not ready for download.');
    }
    if (record.format !== ReportExportFormat.CSV) {
      throw new BadRequestException('Only CSV downloads are available in this export foundation.');
    }
    const table = await this.buildPrivateExportTable(actor, record.reportType as ReportType, record.filters);
    const content = this.csvSerializer.serialize(table);
    await this.repository.auditExportDownload(actor.rtId, record, actor, meta);
    return {
      fileName: record.fileName ?? this.fileName(record.reportType as ReportType, record.filters),
      contentType: 'text/csv; charset=utf-8',
      content,
    };
  }

  async retryExport(actor: AuthPrincipal, exportId: string, meta: ReportRequestMeta): Promise<ReportExportRecord> {
    await this.repository.expireExports(actor.rtId, new Date());
    const existing = await this.getExport(actor, exportId);
    if (existing.status !== 'FAILED') {
      throw new BadRequestException('Only failed report exports can be retried.');
    }
    const queued = await this.repository.retryExportRequest(actor.rtId, exportId, actor, meta);
    if (!queued) {
      throw new NotFoundException('Report export was not found.');
    }
    return queued.format === ReportExportFormat.CSV ? this.processCsvExport(actor, queued, meta) : queued;
  }

  async processPendingCsvExports(command: ProcessReportExportsCommand): Promise<ReportExportProcessingResult> {
    const limit = Math.min(Math.max(command.limit ?? 20, 1), 50);
    const meta: ReportRequestMeta = { correlationId: command.correlationId };
    await this.repository.recoverStaleCsvExports(command.staleBefore ?? new Date(Date.now() - 900_000));
    const records = await this.repository.claimPendingCsvExports(limit);
    let completed = 0;
    let failed = 0;

    for (const record of records) {
      const actor = this.workerActor(record);
      try {
        const result = await this.processCsvExport(actor, record, meta);
        if (result.status === 'COMPLETED') {
          completed += 1;
        } else if (result.status === 'FAILED') {
          failed += 1;
        }
      } catch {
        failed += 1;
        await this.repository.failExportRequest(record.rtId, record.id, 'Report export generation failed.', actor, meta);
      }
    }

    return { processed: records.length, completed, failed };
  }

  async downloadPublicSummaryCsv(rtCode: string): Promise<ReportExportDownload> {
    const summary = await this.getPublicSummary(rtCode);
    return {
      fileName: `public-transparency-${summary.rt.code}-${summary.currentMonth}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: this.csvSerializer.serialize(this.exportEngine.buildPublicSummaryTable(summary)),
    };
  }

  async downloadPublicMonthlyFinanceCsv(rtCode: string, query: PublicMonthlyFinanceQuery): Promise<ReportExportDownload> {
    const report = await this.getPublicMonthlyFinance(rtCode, query);
    return {
      fileName: `public-monthly-finance-${this.normalizeRtCode(rtCode)}-${report.month}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: this.csvSerializer.serialize(this.exportEngine.buildPublicMonthlyFinanceTable(report)),
    };
  }

  async downloadPublicCollectionCsv(rtCode: string, query: PublicMonthlyFinanceQuery): Promise<ReportExportDownload> {
    const report = await this.getPublicMonthlyFinance(rtCode, query);
    return {
      fileName: `public-collection-summary-${this.normalizeRtCode(rtCode)}-${report.month}.csv`,
      contentType: 'text/csv; charset=utf-8',
      content: this.csvSerializer.serialize(this.exportEngine.buildPublicCollectionTable(report)),
    };
  }

  async getPublicSummary(rtCode: string): Promise<PublicTransparencySummary> {
    const record = await this.repository.getPublicSummaryByRtCode(this.normalizeRtCode(rtCode));
    if (!record) {
      throw new NotFoundException('Public report was not found.');
    }
    return {
      rt: { code: record.rt.code, name: record.rt.name },
      cashBalance: {
        totalBalance: record.cashBalance.totalBalance,
        currency: record.cashBalance.currency,
        accountCount: record.cashBalance.accountCount,
      },
      totals: {
        income: record.totals.income,
        expense: record.totals.expense,
        netCashFlow: record.totals.netCashFlow,
      },
      currentMonth: record.currentMonth,
      lastUpdatedAt: record.lastUpdatedAt,
    };
  }

  async getPublicMonthlyFinance(rtCode: string, query: PublicMonthlyFinanceQuery): Promise<PublicMonthlyFinanceReport> {
    this.assertMonth(query.month);
    const record = await this.repository.getPublicMonthlyFinanceByRtCode(this.normalizeRtCode(rtCode), query);
    if (!record) {
      throw new NotFoundException('Public monthly report was not found.');
    }
    return {
      month: record.month,
      totals: {
        income: record.totals.income,
        expense: record.totals.expense,
        netCashFlow: record.totals.netCashFlow,
      },
      categorySummaries: record.categorySummaries.map((item) => ({
        categoryKey: item.categoryKey,
        categoryName: item.categoryName,
        type: item.type,
        total: item.total,
        direction: item.direction,
      })),
      generatedAt: record.generatedAt,
    };
  }

  async listPublicReportMetadata(rtCode: string, query: PublicFeedQuery): Promise<PaginatedResult<PublicReportMetadata>> {
    const result = await this.repository.listPublicReportMetadataByRtCode(this.normalizeRtCode(rtCode), query);
    if (!result) {
      throw new NotFoundException('Public report feed was not found.');
    }
    return result;
  }

  async listPublicAnnouncements(rtCode: string, query: PublicFeedQuery): Promise<PaginatedResult<PublicAnnouncement>> {
    const result = await this.repository.listPublicAnnouncementsByRtCode(this.normalizeRtCode(rtCode), query);
    if (!result) {
      throw new NotFoundException('Public announcements were not found.');
    }
    return result;
  }

  private normalizeExportCommand(command: CreateReportExportCommand): CreateReportExportCommand {
    const filters = command.filters ?? {};
    this.assertSafeExportFilters(filters);
    const visibility = command.visibility ?? (PUBLIC_SAFE_EXPORT_TYPES.has(command.reportType) ? 'PUBLIC_SAFE' : 'PRIVATE');
    if (visibility === 'PUBLIC_SAFE' && PRIVATE_ONLY_EXPORT_TYPES.has(command.reportType)) {
      throw new BadRequestException('This report export type is private only.');
    }
    if (PUBLIC_SAFE_EXPORT_TYPES.has(command.reportType) && visibility !== 'PUBLIC_SAFE') {
      throw new BadRequestException('Public transparency exports must use PUBLIC_SAFE visibility.');
    }
    const normalizedFilters = this.normalizeExportFilters(command.reportType, { ...filters, visibility });
    return { ...command, filters: normalizedFilters, visibility };
  }

  private normalizeExportFilters(reportType: ReportType, filters: Record<string, unknown>): Record<string, unknown> {
    if (reportType === 'MONTHLY_FINANCE_SUMMARY' || reportType === 'PUBLIC_MONTHLY_FINANCE') {
      const month = typeof filters.month === 'string' ? filters.month : undefined;
      if (month) {
        this.assertMonth(month);
        return { ...filters, month, dateFrom: `${month}-01`, dateTo: this.endOfMonth(month) };
      }
    }
    if (typeof filters.dateFrom === 'string' || typeof filters.dateTo === 'string') {
      const range = this.normalizeDateRange({ dateFrom: filters.dateFrom as string | undefined, dateTo: filters.dateTo as string | undefined });
      return { ...filters, dateFrom: range.dateFrom, dateTo: range.dateTo };
    }
    return filters;
  }

  private async processCsvExport(actor: AuthPrincipal, record: ReportExportRecord, meta: ReportRequestMeta): Promise<ReportExportRecord> {
    await this.repository.markExportProcessing(actor.rtId, record.id, actor, meta);
    try {
      await this.buildPrivateExportTable(actor, record.reportType as ReportType, record.filters);
      const completed = await this.repository.completeExportRequest(actor.rtId, record.id, this.fileMetadata(actor.rtId, record), actor, meta);
      if (!completed) {
        throw new NotFoundException('Report export was not found.');
      }
      return completed;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      const failed = await this.repository.failExportRequest(actor.rtId, record.id, 'Report export generation failed.', actor, meta);
      if (!failed) {
        throw new NotFoundException('Report export was not found.');
      }
      return failed;
    }
  }

  private workerActor(record: ReportExportRecord): AuthPrincipal {
    return {
      userId: record.requestedById,
      membershipId: `report-export-worker:${record.id}`,
      rtId: record.rtId,
      roles: ['SYSTEM_WORKER'],
      permissions: [],
    };
  }

  private async buildPrivateExportTable(actor: AuthPrincipal, reportType: ReportType, filters: Record<string, unknown>): Promise<ReportExportTable> {
    if (reportType === 'PUBLIC_TRANSPARENCY_SUMMARY') {
      const summary = await this.repository.getFinanceSummary(actor.rtId, this.financeQueryFromFilters(filters));
      return this.exportEngine.buildPublicSummaryTable({
        rt: { code: actor.rtId, name: 'RT' },
        cashBalance: {
          totalBalance: summary.cashBalances.reduce((total, account) => total + Number(account.balance), 0).toString(),
          currency: summary.cashBalances[0]?.currency ?? 'IDR',
          accountCount: summary.cashBalances.length,
        },
        totals: {
          income: summary.totals.income,
          expense: summary.totals.expense,
          netCashFlow: summary.totals.netCashFlow,
        },
        currentMonth: (typeof filters.month === 'string' ? filters.month : summary.range.dateFrom.slice(0, 7)),
        lastUpdatedAt: summary.generatedAt,
      });
    }
    if (reportType === 'PUBLIC_MONTHLY_FINANCE') {
      const summary = await this.repository.getFinanceSummary(actor.rtId, this.financeQueryFromFilters(filters));
      return this.exportEngine.buildPublicMonthlyFinanceTable({
        month: typeof filters.month === 'string' ? filters.month : summary.range.dateFrom.slice(0, 7),
        totals: {
          income: summary.totals.income,
          expense: summary.totals.expense,
          netCashFlow: summary.totals.netCashFlow,
        },
        categorySummaries: summary.categoryBreakdown.map((item) => ({
          categoryKey: item.categoryKey,
          categoryName: item.categoryName,
          type: item.type,
          total: item.type === 'INCOME' ? item.income : item.expense,
          direction: item.type === 'INCOME' ? 'INCREASE' : 'DECREASE',
        })),
        generatedAt: summary.generatedAt,
      });
    }
    if (reportType === 'COLLECTION_SUMMARY' || reportType === 'COLLECTION_PERFORMANCE') {
      return this.exportEngine.buildCollectionSummaryTable(await this.repository.getCollectionPerformance(actor.rtId, this.collectionQueryFromFilters(filters)));
    }
    if (reportType === 'LEDGER_EXPORT') {
      return this.exportEngine.buildLedgerTable(await this.repository.getLedgerExportRows(actor.rtId, this.financeQueryFromFilters(filters)));
    }
    if (reportType === 'TRANSACTION_EXPORT') {
      return this.exportEngine.buildTransactionTable(await this.repository.getTransactionExportRows(actor.rtId, this.financeQueryFromFilters(filters)));
    }
    return this.exportEngine.buildMonthlyFinanceTable(await this.repository.getFinanceSummary(actor.rtId, this.financeQueryFromFilters(filters)));
  }

  private financeQueryFromFilters(filters: Record<string, unknown>): FinanceReportQuery {
    const query: FinanceReportQuery = {
      period: typeof filters.period === 'string' ? (filters.period as FinanceReportQuery['period']) : 'CUSTOM',
      dateFrom: typeof filters.dateFrom === 'string' ? filters.dateFrom : undefined,
      dateTo: typeof filters.dateTo === 'string' ? filters.dateTo : undefined,
      cashAccountId: typeof filters.cashAccountId === 'string' ? filters.cashAccountId : undefined,
    };
    return this.normalizeDateRange(query);
  }

  private collectionQueryFromFilters(filters: Record<string, unknown>): CollectionReportQuery {
    const query: CollectionReportQuery = {
      dateFrom: typeof filters.dateFrom === 'string' ? filters.dateFrom : undefined,
      dateTo: typeof filters.dateTo === 'string' ? filters.dateTo : undefined,
      areaId: typeof filters.areaId === 'string' ? filters.areaId : undefined,
    };
    return this.normalizeDateRange(query);
  }

  private fileMetadata(rtId: string, record: ReportExportRecord): ReportExportFileMetadata {
    const now = new Date();
    return {
      fileName: this.fileName(record.reportType as ReportType, record.filters),
      objectKey: `report-exports/${rtId}/${record.id}.csv`,
      completedAt: now,
      expiresAt: new Date(now.getTime() + EXPORT_EXPIRATION_DAYS * 86_400_000),
    };
  }

  private fileName(reportType: ReportType, filters: Record<string, unknown>): string {
    const stem = reportType.toLowerCase().replaceAll('_', '-');
    const period = typeof filters.month === 'string' ? filters.month : typeof filters.dateFrom === 'string' ? filters.dateFrom : this.toDateOnly(new Date());
    return `${stem}-${period}.csv`;
  }

  private normalizeDateRange<T extends FinanceReportQuery | CollectionReportQuery | OutstandingReportQuery | ExpenseCategoryReportQuery | ApprovalActivityReportQuery | AuditActivityReportQuery>(query: T): T {
    const now = new Date();
    const defaultFrom = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const defaultTo = this.toDateOnly(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
    const dateFrom = query.dateFrom ?? defaultFrom;
    const dateTo = query.dateTo ?? defaultTo;
    this.assertDateOnly(dateFrom, 'dateFrom');
    this.assertDateOnly(dateTo, 'dateTo');

    const fromTime = Date.parse(`${dateFrom}T00:00:00.000Z`);
    const toTime = Date.parse(`${dateTo}T00:00:00.000Z`);
    if (toTime < fromTime) {
      throw new BadRequestException('dateTo must be the same as or after dateFrom.');
    }
    const days = Math.floor((toTime - fromTime) / 86_400_000) + 1;
    if (days > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Report date range cannot exceed ${MAX_RANGE_DAYS} days.`);
    }

    return { ...query, dateFrom, dateTo };
  }

  private normalizeRtCode(rtCode: string): string {
    const normalized = rtCode.trim();
    if (!RT_CODE_PATTERN.test(normalized)) {
      throw new BadRequestException('Invalid RT code.');
    }
    return normalized;
  }

  private assertDateOnly(value: string, field: string): void {
    if (!DATE_ONLY_PATTERN.test(value)) {
      throw new BadRequestException(`${field} must be a valid YYYY-MM-DD date.`);
    }
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      throw new BadRequestException(`${field} must be a valid YYYY-MM-DD date.`);
    }
  }

  private assertMonth(value: string): void {
    if (!MONTH_PATTERN.test(value)) {
      throw new BadRequestException('month must be a valid YYYY-MM value.');
    }
    const [year, month] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, 1));
    if (month < 1 || month > 12 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1) {
      throw new BadRequestException('month must be a valid YYYY-MM value.');
    }
  }

  private toDateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private endOfMonth(month: string): string {
    const [year, rawMonth] = month.split('-').map(Number);
    return new Date(Date.UTC(year, rawMonth, 0)).toISOString().slice(0, 10);
  }

  private assertSafeExportFilters(filters: Record<string, unknown>): void {
    this.assertSafeJsonValue(filters, 0);
    const serialized = JSON.stringify(filters);
    if (serialized.length > MAX_EXPORT_FILTER_BYTES) {
      throw new BadRequestException('Report export filters are too large.');
    }
  }

  private assertSafeJsonValue(value: unknown, depth: number): void {
    if (depth > MAX_EXPORT_FILTER_DEPTH) {
      throw new BadRequestException('Report export filters are too deeply nested.');
    }
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        this.assertSafeJsonValue(item, depth + 1);
      }
      return;
    }
    if (typeof value !== 'object') {
      throw new BadRequestException('Report export filters must be JSON serializable.');
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (UNSAFE_JSON_KEYS.has(key)) {
        throw new BadRequestException('Report export filters contain unsafe keys.');
      }
      this.assertSafeJsonValue(nested, depth + 1);
    }
  }
}
