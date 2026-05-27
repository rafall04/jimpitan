/**
 * Purpose: Frontend finance, ledger, and approval contract types mirrored from backend responses.
 * Caller: Finance API client, hooks, workflow helpers, pages, and tests.
 * Deps: None.
 * MainFuncs: Defines accounts, categories, transactions, ledger rows, approval rows, report exports, query params, and mutation payloads.
 * SideEffects: None.
 */
export type SortDirection = 'asc' | 'desc';

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ADJUSTMENT';
export type TransactionStatus = 'DRAFT' | 'VALIDATED' | 'PENDING_VALIDATION' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'VOIDED';
export type LedgerEntryType = 'INCREASE' | 'DECREASE';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ApprovalWorkflowStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
export type ReportExportFormat = 'CSV' | 'PDF' | 'EXCEL';
export type ReportExportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
export type ReportExportVisibility = 'PRIVATE' | 'PUBLIC_SAFE';
export type ReportType =
  | 'MONTHLY_FINANCE_SUMMARY'
  | 'FINANCE_SUMMARY'
  | 'COLLECTION_SUMMARY'
  | 'COLLECTION_PERFORMANCE'
  | 'LEDGER_EXPORT'
  | 'TRANSACTION_EXPORT'
  | 'PUBLIC_TRANSPARENCY_SUMMARY'
  | 'PUBLIC_MONTHLY_FINANCE';

export type CashAccountRecord = {
  id: string;
  rtId: string;
  key: string;
  name: string;
  currency: string;
  currentBalance: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TransactionCategoryRecord = {
  id: string;
  rtId: string | null;
  type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;
  key: string;
  name: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LedgerEntryRecord = {
  id: string;
  rtId: string;
  cashAccountId: string;
  transactionId: string;
  ledgerSequence: number;
  entryType: LedgerEntryType;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  ledgerDate: string;
  createdAt: string;
};

export type FinanceTransactionRecord = {
  id: string;
  rtId: string;
  cashAccountId: string;
  categoryId: string;
  sourceCollectionId: string | null;
  referenceNumber: string | null;
  idempotencyKey: string | null;
  externalRef: string | null;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  description: string;
  transactionDate: string;
  createdById: string;
  updatedById: string | null;
  validatedById: string | null;
  validatedAt: string | null;
  validationNote: string | null;
  rejectedById: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  postedById: string | null;
  postedAt: string | null;
  voidedById: string | null;
  voidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  cashAccount: Pick<CashAccountRecord, 'id' | 'key' | 'name' | 'currency'>;
  category: Pick<TransactionCategoryRecord, 'id' | 'type' | 'key' | 'name'>;
  ledger: LedgerEntryRecord | null;
};

export type CashAccountBalance = {
  cashAccountId: string;
  balance: string;
  ledgerSequence?: number;
  latestLedgerSequence?: number;
  calculatedAt: string;
};

export type SourceCollectionPostingResult = {
  collectionId: string;
  collectionMode?: 'PER_HOUSE' | 'BULK_TOTAL' | 'HYBRID';
  collectionTotalAmount?: string;
  transaction: FinanceTransactionRecord;
  ledger: LedgerEntryRecord;
};

export type FinanceSummaryReport = {
  reportType: string;
  period: string;
  range: { dateFrom: string; dateTo: string };
  totals: {
    income: string;
    expense: string;
    netCashFlow: string;
    ledgerEntryCount: number;
    transactionCount: number;
  };
  cashBalances: Array<{
    cashAccountId: string;
    key: string;
    name: string;
    currency: string;
    balance: string;
    ledgerSequence: number;
  }>;
  generatedAt: string;
};

export type CashFlowSummaryReport = {
  range: { dateFrom: string; dateTo: string };
  openingBalance: string;
  income: string;
  expense: string;
  netCashFlow: string;
  closingBalance: string;
  generatedAt: string;
};

export type ApprovalTransactionSummary = {
  id: string;
  rtId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: string;
  createdById: string;
};

export type ApprovalApproverSummary = {
  membershipId: string;
  userId: string;
  fullName: string;
};

export type ApprovalRecord = {
  id: string;
  rtId: string;
  transactionId: string;
  requestedById: string;
  approverMembershipId: string;
  decisionById: string | null;
  idempotencyKey: string | null;
  status: ApprovalStatus;
  reason: string | null;
  decisionNote: string | null;
  expiresAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
  approver: ApprovalApproverSummary;
  transaction: ApprovalTransactionSummary;
};

export type ApprovalStateRecord = {
  transactionId: string;
  status: ApprovalWorkflowStatus;
  requiredApprovals: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  approvals: ApprovalRecord[];
  transaction: ApprovalTransactionSummary;
};

export type ReportExportRecord = {
  id: string;
  rtId: string;
  requestedById: string;
  reportType: string;
  format: ReportExportFormat;
  status: ReportExportStatus;
  filters: Record<string, unknown>;
  fileName: string | null;
  objectKey: string | null;
  errorMessage: string | null;
  idempotencyKey: string | null;
  expiresAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateReportExportPayload = {
  reportType: ReportType;
  format: ReportExportFormat;
  filters?: Record<string, unknown>;
  idempotencyKey?: string;
  visibility?: ReportExportVisibility;
};

export type ReportExportListParams = {
  page?: number;
  limit?: number;
  reportType?: ReportType;
  status?: ReportExportStatus;
};

export type ReportExportDownload = {
  fileName: string;
  content: string;
};

export type AccountListParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'name' | 'key' | 'updatedAt';
  sortDirection?: SortDirection;
};

export type CategoryListParams = AccountListParams & {
  type?: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;
};

export type TransactionListParams = {
  page?: number;
  limit?: number;
  type?: Extract<TransactionType, 'INCOME' | 'EXPENSE' | 'ADJUSTMENT'>;
  status?: TransactionStatus;
  cashAccountId?: string;
  categoryId?: string;
  sourceCollectionId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'transactionDate' | 'status' | 'updatedAt' | 'amount';
  sortDirection?: SortDirection;
};

export type LedgerListParams = {
  page?: number;
  limit?: number;
  cashAccountId?: string;
  transactionId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortDirection?: SortDirection;
};

export type ApprovalListParams = {
  page?: number;
  limit?: number;
  status?: ApprovalStatus;
  transactionId?: string;
  approverMembershipId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'status';
  sortDirection?: SortDirection;
};

export type CreateCashAccountPayload = {
  key?: string;
  name: string;
  currency?: string;
};

export type UpdateCashAccountPayload = {
  name?: string;
  isActive?: boolean;
};

export type CreateCategoryPayload = {
  type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;
  key: string;
  name: string;
};

export type UpdateCategoryPayload = {
  name?: string;
  isActive?: boolean;
};

export type CreateTransactionPayload = {
  cashAccountId: string;
  categoryId: string;
  amount: string;
  description: string;
  transactionDate: string;
  referenceNumber?: string;
  idempotencyKey?: string;
  externalRef?: string;
};

export type PostCollectionPayload = {
  collectionId: string;
  cashAccountId?: string;
  categoryId?: string;
  idempotencyKey?: string;
};
