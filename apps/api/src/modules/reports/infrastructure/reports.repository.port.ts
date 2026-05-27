/**
 * Purpose: Persistence port for tenant-scoped private reports, public transparency reads, and export requests.
 * Caller: ReportsService.
 * Deps: Reporting command and domain types plus shared pagination type.
 * MainFuncs: Declares ledger-derived reporting, public-safe reporting, and export repository operations.
 * SideEffects: Implementations may read report source tables and write report export/audit rows.
 */
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
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
} from '../application/reports.commands';
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
  LedgerExportRow,
  ReportExportFileMetadata,
  ReportExportRecord,
  TransactionExportRow,
} from '../domain/reports.types';

export interface ReportsRepositoryPort {
  getFinanceSummary(rtId: string, query: FinanceReportQuery): Promise<FinanceSummaryReport>;
  getCollectionPerformance(rtId: string, query: CollectionReportQuery): Promise<CollectionPerformanceReport>;
  getOutstandingHouses(rtId: string, query: OutstandingReportQuery): Promise<PaginatedResult<OutstandingHouseReportItem>>;
  getPerAreaProgress(rtId: string, query: CollectionReportQuery): Promise<AreaProgressReportItem[]>;
  getExpenseCategoryBreakdown(rtId: string, query: ExpenseCategoryReportQuery): Promise<ExpenseCategoryBreakdownReport>;
  getCashFlowSummary(rtId: string, query: FinanceReportQuery): Promise<CashFlowSummaryReport>;
  getApprovalActivity(rtId: string, query: ApprovalActivityReportQuery): Promise<ApprovalActivityReport>;
  getAuditActivity(rtId: string, query: AuditActivityReportQuery): Promise<AuditActivityReport>;
  createExportRequest(rtId: string, command: CreateReportExportCommand, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord>;
  recoverStaleCsvExports(staleBefore: Date): Promise<number>;
  claimPendingCsvExports(limit: NonNullable<ProcessReportExportsCommand['limit']>): Promise<ReportExportRecord[]>;
  markExportProcessing(rtId: string, exportId: string, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord | null>;
  completeExportRequest(rtId: string, exportId: string, metadata: ReportExportFileMetadata, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord | null>;
  failExportRequest(rtId: string, exportId: string, errorMessage: string, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord | null>;
  retryExportRequest(rtId: string, exportId: string, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<ReportExportRecord | null>;
  auditExportDownload(rtId: string, record: ReportExportRecord, actor: AuthPrincipal, meta: ReportRequestMeta): Promise<void>;
  expireExports(rtId: string, now: Date): Promise<number>;
  listExportRequests(rtId: string, query: ReportExportListQuery): Promise<PaginatedResult<ReportExportRecord>>;
  findExportRequestById(rtId: string, exportId: string): Promise<ReportExportRecord | null>;
  getLedgerExportRows(rtId: string, query: FinanceReportQuery): Promise<LedgerExportRow[]>;
  getTransactionExportRows(rtId: string, query: FinanceReportQuery): Promise<TransactionExportRow[]>;
  getPublicSummaryByRtCode(rtCode: string): Promise<PublicTransparencySummary | null>;
  getPublicMonthlyFinanceByRtCode(rtCode: string, query: PublicMonthlyFinanceQuery): Promise<PublicMonthlyFinanceReport | null>;
  listPublicReportMetadataByRtCode(rtCode: string, query: PublicFeedQuery): Promise<PaginatedResult<PublicReportMetadata> | null>;
  listPublicAnnouncementsByRtCode(rtCode: string, query: PublicFeedQuery): Promise<PaginatedResult<PublicAnnouncement> | null>;
}
