/**
 * Purpose: Reporting domain response types for private reports, public transparency, and export state.
 * Caller: Reports service, controllers, repository ports, and future export workers.
 * Deps: Prisma enum types and shared pagination type.
 * MainFuncs: Defines ledger-derived financial summaries, mode-aware collection reports, public-safe DTO shapes, and export records.
 * SideEffects: None.
 */
import type { ApprovalStatus, CollectionItemStatus, LedgerEntryType, ReportExportFormat, TransactionStatus, TransactionType } from '@prisma/client';
import type { CollectionMode } from '../../jimpitan/domain/collection-mode.types';

export type ReportSnapshotMeta = {
  generatedAt: Date;
  version: number;
  source: 'LEDGER' | 'COLLECTION' | 'APPROVAL' | 'AUDIT';
  cacheStrategy: 'LIVE_LEDGER_QUERY' | 'LIVE_DOMAIN_QUERY';
};

export type ReportDateRange = {
  dateFrom: string;
  dateTo: string;
};

export type LedgerReportSource = {
  type: 'LEDGER';
  postedOnly: true;
};

export type FinanceTotals = {
  income: string;
  expense: string;
  netCashFlow: string;
  ledgerEntryCount: number;
  transactionCount: number;
};

export type CashBalanceSummary = {
  cashAccountId: string;
  key: string;
  name: string;
  currency: string;
  balance: string;
  ledgerSequence: number;
};

export type CategoryBreakdownItem = {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  type: TransactionType;
  income: string;
  expense: string;
  net: string;
  transactionCount: number;
};

export type FinanceSummaryReport = {
  reportType: string;
  period: string;
  range: ReportDateRange;
  totals: FinanceTotals;
  cashBalances: CashBalanceSummary[];
  categoryBreakdown: CategoryBreakdownItem[];
  source: LedgerReportSource;
  snapshot: ReportSnapshotMeta;
  generatedAt: Date;
};

export type CollectionPerformanceReport = {
  range: ReportDateRange;
  totalCollections: number;
  perHouseCollections?: number;
  bulkTotalCollections?: number;
  hybridCollections?: number;
  validatedCollections: number;
  submittedCollections: number;
  totalCollected: string;
  totalItems: number;
  paidItems: number;
  unpaidItems: number;
  completionRate: number;
  snapshot: ReportSnapshotMeta;
  generatedAt: Date;
};

export type OutstandingHouseReportItem = {
  collectionId: string;
  collectionDate: Date;
  collectionMode?: CollectionMode;
  houseId: string;
  houseNumber: string;
  area: {
    id: string;
    code: string;
    name: string;
  };
  status: CollectionItemStatus;
  amount: string;
};

export type AreaProgressReportItem = {
  areaId: string;
  areaCode: string;
  areaName: string;
  collectionMode?: CollectionMode;
  totalHouses: number;
  completedHouses: number;
  paidHouses: number;
  outstandingHouses: number;
  totalCollected: string;
};

export type ExpenseCategoryBreakdownReport = {
  range: ReportDateRange;
  categories: CategoryBreakdownItem[];
  snapshot: ReportSnapshotMeta;
  generatedAt: Date;
};

export type CashFlowSummaryReport = {
  range: ReportDateRange;
  openingBalance: string;
  income: string;
  expense: string;
  netCashFlow: string;
  closingBalance: string;
  snapshot: ReportSnapshotMeta;
  generatedAt: Date;
};

export type ApprovalActivityReport = {
  range: ReportDateRange;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byStatus: Array<{ status: ApprovalStatus; count: number }>;
  snapshot: ReportSnapshotMeta;
  generatedAt: Date;
};

export type AuditActivityReport = {
  range: ReportDateRange;
  totalEvents: number;
  byAction: Array<{ action: string; count: number }>;
  byEntityType: Array<{ entityType: string; count: number }>;
  snapshot: ReportSnapshotMeta;
  generatedAt: Date;
};

export type PublicTransparencySummary = {
  rt: {
    code: string;
    name: string;
  };
  cashBalance: {
    totalBalance: string;
    currency: string;
    accountCount: number;
  };
  totals: {
    income: string;
    expense: string;
    netCashFlow: string;
  };
  currentMonth: string;
  lastUpdatedAt: Date;
};

export type PublicMonthlyFinanceReport = {
  month: string;
  totals: {
    income: string;
    expense: string;
    netCashFlow: string;
  };
  categorySummaries: Array<{
    categoryKey: string;
    categoryName: string;
    type: TransactionType;
    total: string;
    direction: LedgerEntryType;
  }>;
  generatedAt: Date;
};

export type PublicReportMetadata = {
  id: string;
  title: string;
  publishedAt: Date;
  type: 'ANNOUNCEMENT';
};

export type PublicAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
};

export type ReportExportStatusView = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export type ReportExportFileMetadata = {
  fileName: string;
  objectKey: string;
  expiresAt: Date;
  completedAt: Date;
};

export type ReportExportDownload = {
  fileName: string;
  contentType: 'text/csv; charset=utf-8';
  content: string;
};

export type ReportExportProcessingResult = {
  processed: number;
  completed: number;
  failed: number;
};

export type LedgerExportRow = {
  ledgerDate: Date;
  ledgerSequence: number;
  entryType: LedgerEntryType;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  cashAccountName: string;
  transactionId: string;
};

export type TransactionExportRow = {
  transactionDate: Date;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  categoryName: string;
  cashAccountName: string;
  description: string;
  referenceNumber: string | null;
};

export type ReportExportRecord = {
  id: string;
  rtId: string;
  requestedById: string;
  reportType: string;
  format: ReportExportFormat;
  status: ReportExportStatusView;
  filters: Record<string, unknown>;
  fileName: string | null;
  objectKey: string | null;
  errorMessage: string | null;
  idempotencyKey: string | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
