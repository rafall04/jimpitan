/**
 * Purpose: Command and query contracts for private reports, public transparency, and export requests.
 * Caller: Reports controllers, services, and repository ports.
 * Deps: Prisma report export enums and shared pagination type.
 * MainFuncs: Defines date-range, mode-aware collection report, public feed, and export request payload shapes.
 * SideEffects: None.
 */
import type { CollectionItemStatus, CollectionStatus, ReportExportFormat, TransactionType } from '@prisma/client';
import type { PaginationInput } from '../../../common/types/paginated-result.type';
import type { CollectionMode } from '../../jimpitan/domain/collection-mode.types';
import type { ReportExportStatusView } from '../domain/reports.types';

export type ReportRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type ReportSortDirection = 'asc' | 'desc';
export type ReportPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';

export type ReportDateRangeQuery = {
  period?: ReportPeriod;
  dateFrom?: string;
  dateTo?: string;
};

export type FinanceReportQuery = ReportDateRangeQuery & {
  cashAccountId?: string;
};

export type CollectionReportQuery = ReportDateRangeQuery & {
  areaId?: string;
  collectionMode?: CollectionMode;
  collectionStatus?: CollectionStatus;
};

export type OutstandingReportQuery = PaginationInput &
  ReportDateRangeQuery & {
    areaId?: string;
    collectionId?: string;
    collectionMode?: CollectionMode;
    status?: CollectionItemStatus;
    search?: string;
    sortDirection?: ReportSortDirection;
  };

export type ExpenseCategoryReportQuery = ReportDateRangeQuery & {
  categoryId?: string;
};

export type ApprovalActivityReportQuery = ReportDateRangeQuery & {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
};

export type AuditActivityReportQuery = ReportDateRangeQuery & {
  action?: string;
  entityType?: string;
};

export type PublicMonthlyFinanceQuery = {
  month: string;
};

export type PublicFeedQuery = PaginationInput & {
  search?: string;
};

export type ReportExportListQuery = PaginationInput & {
  reportType?: ReportType;
  status?: ReportExportStatusView;
};

export type ReportExportVisibility = 'PRIVATE' | 'PUBLIC_SAFE';

export type ProcessReportExportsCommand = {
  limit?: number;
  correlationId?: string;
  staleBefore?: Date;
};

export type ReportType =
  | 'DAILY_FINANCE_SUMMARY'
  | 'WEEKLY_FINANCE_SUMMARY'
  | 'MONTHLY_FINANCE_SUMMARY'
  | 'YEARLY_FINANCE_SUMMARY'
  | 'FINANCE_SUMMARY'
  | 'COLLECTION_PERFORMANCE'
  | 'COLLECTION_SUMMARY'
  | 'OUTSTANDING_HOUSES'
  | 'PER_AREA_COLLECTION_PROGRESS'
  | 'EXPENSE_CATEGORY_BREAKDOWN'
  | 'CASH_FLOW_SUMMARY'
  | 'APPROVAL_ACTIVITY'
  | 'AUDIT_ACTIVITY'
  | 'LEDGER_EXPORT'
  | 'TRANSACTION_EXPORT'
  | 'PUBLIC_TRANSPARENCY_SUMMARY'
  | 'PUBLIC_MONTHLY_FINANCE';

export type CreateReportExportCommand = {
  reportType: ReportType;
  format: ReportExportFormat;
  filters?: Record<string, unknown>;
  idempotencyKey?: string;
  visibility?: ReportExportVisibility;
};

export type CategorySummaryFilter = {
  type?: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;
};
