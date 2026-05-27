/**
 * Purpose: Browser API adapter for tenant-scoped finance, ledger, and approval endpoints.
 * Caller: Finance/approval TanStack hooks and dashboard pages.
 * Deps: Same-origin backend proxy, ApiError, finance query serializer, and response types.
 * MainFuncs: Lists and mutates accounts, categories, transactions, collection posting, ledger reads, approvals, and report exports.
 * SideEffects: Performs browser fetch requests with cookies, active tenant headers, and idempotency headers.
 */
import { ApiError } from '@/lib/api/api-error';
import { buildFinanceQuery } from './schemas';
import type {
  AccountListParams,
  ApprovalListParams,
  ApprovalRecord,
  ApprovalStateRecord,
  CashAccountBalance,
  CashAccountRecord,
  CashFlowSummaryReport,
  CategoryListParams,
  CreateCashAccountPayload,
  CreateCategoryPayload,
  CreateReportExportPayload,
  CreateTransactionPayload,
  FinanceTransactionRecord,
  FinanceSummaryReport,
  LedgerEntryRecord,
  LedgerListParams,
  PaginatedResult,
  PostCollectionPayload,
  ReportExportDownload,
  ReportExportListParams,
  ReportExportRecord,
  SourceCollectionPostingResult,
  TransactionCategoryRecord,
  TransactionListParams,
  UpdateCashAccountPayload,
  UpdateCategoryPayload,
} from './types';

export async function listCashAccounts(tenantId: string, params: AccountListParams = {}): Promise<PaginatedResult<CashAccountRecord>> {
  return appApiJson(`/api/backend/finance/cash-accounts${buildFinanceQuery(params)}`, { tenantId });
}

export async function createCashAccount(tenantId: string, payload: CreateCashAccountPayload): Promise<CashAccountRecord> {
  return appApiJson('/api/backend/finance/cash-accounts', { method: 'POST', tenantId, body: payload });
}

export async function updateCashAccount(tenantId: string, accountId: string, payload: UpdateCashAccountPayload): Promise<CashAccountRecord> {
  return appApiJson(`/api/backend/finance/cash-accounts/${accountId}`, { method: 'PATCH', tenantId, body: payload });
}

export async function archiveCashAccount(tenantId: string, accountId: string, reason: string): Promise<CashAccountRecord> {
  return appApiJson(`/api/backend/finance/cash-accounts/${accountId}/archive`, { method: 'PATCH', tenantId, body: { reason } });
}

export async function getDefaultCashAccount(tenantId: string): Promise<CashAccountRecord> {
  return appApiJson('/api/backend/finance/cash-accounts/default', { tenantId });
}

export async function getCashAccountBalance(tenantId: string, accountId: string): Promise<CashAccountBalance> {
  return appApiJson(`/api/backend/finance/cash-accounts/${accountId}/balance`, { tenantId });
}

export async function listCategories(tenantId: string, params: CategoryListParams = {}): Promise<PaginatedResult<TransactionCategoryRecord>> {
  return appApiJson(`/api/backend/finance/categories${buildFinanceQuery(params)}`, { tenantId });
}

export async function createCategory(tenantId: string, payload: CreateCategoryPayload): Promise<TransactionCategoryRecord> {
  return appApiJson('/api/backend/finance/categories', { method: 'POST', tenantId, body: payload });
}

export async function updateCategory(tenantId: string, categoryId: string, payload: UpdateCategoryPayload): Promise<TransactionCategoryRecord> {
  return appApiJson(`/api/backend/finance/categories/${categoryId}`, { method: 'PATCH', tenantId, body: payload });
}

export async function archiveCategory(tenantId: string, categoryId: string, reason: string): Promise<TransactionCategoryRecord> {
  return appApiJson(`/api/backend/finance/categories/${categoryId}/archive`, { method: 'PATCH', tenantId, body: { reason } });
}

export async function listTransactions(tenantId: string, params: TransactionListParams = {}): Promise<PaginatedResult<FinanceTransactionRecord>> {
  return appApiJson(`/api/backend/finance/transactions${buildFinanceQuery(params)}`, { tenantId });
}

export async function getFinanceSummary(tenantId: string, params: { period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'; dateFrom?: string; dateTo?: string } = { period: 'MONTHLY' }): Promise<FinanceSummaryReport> {
  return appApiJson(`/api/backend/reports/finance/summary${buildFinanceQuery(params)}`, { tenantId });
}

export async function getCashFlowSummary(tenantId: string, params: { period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'; dateFrom?: string; dateTo?: string } = { period: 'MONTHLY' }): Promise<CashFlowSummaryReport> {
  return appApiJson(`/api/backend/reports/finance/cash-flow${buildFinanceQuery(params)}`, { tenantId });
}

export async function createReportExport(tenantId: string, payload: CreateReportExportPayload): Promise<ReportExportRecord> {
  return appApiJson('/api/backend/reports/exports', { method: 'POST', tenantId, body: payload, idempotencyKey: payload.idempotencyKey });
}

export async function listReportExports(tenantId: string, params: ReportExportListParams = {}): Promise<PaginatedResult<ReportExportRecord>> {
  return appApiJson(`/api/backend/reports/exports${buildFinanceQuery(params)}`, { tenantId });
}

export async function retryReportExport(tenantId: string, exportId: string): Promise<ReportExportRecord> {
  return appApiJson(`/api/backend/reports/exports/${exportId}/retry`, { method: 'POST', tenantId, body: {} });
}

export async function downloadReportExport(tenantId: string, exportId: string): Promise<ReportExportDownload> {
  const response = await appApiRaw(`/api/backend/reports/exports/${exportId}/download`, { tenantId, accept: 'text/csv' });
  const fileName = parseFileName(response.headers.get('content-disposition')) ?? `report-export-${exportId}.csv`;
  return { fileName, content: await response.text() };
}

export async function getTransaction(tenantId: string, transactionId: string): Promise<FinanceTransactionRecord> {
  return appApiJson(`/api/backend/finance/transactions/${transactionId}`, { tenantId });
}

export async function createTransactionDraft(tenantId: string, type: 'income' | 'expense', payload: CreateTransactionPayload): Promise<FinanceTransactionRecord> {
  return appApiJson(`/api/backend/finance/transactions/${type}`, { method: 'POST', tenantId, body: payload, idempotencyKey: payload.idempotencyKey });
}

export async function validateTransaction(tenantId: string, transactionId: string, validationNote?: string): Promise<FinanceTransactionRecord> {
  return appApiJson(`/api/backend/finance/transactions/${transactionId}/validate`, { method: 'PATCH', tenantId, body: { validationNote } });
}

export async function rejectTransaction(tenantId: string, transactionId: string, rejectionReason: string): Promise<FinanceTransactionRecord> {
  return appApiJson(`/api/backend/finance/transactions/${transactionId}/reject`, { method: 'PATCH', tenantId, body: { rejectionReason } });
}

export async function voidTransaction(tenantId: string, transactionId: string, voidReason: string): Promise<FinanceTransactionRecord> {
  return appApiJson(`/api/backend/finance/transactions/${transactionId}/void`, { method: 'PATCH', tenantId, body: { voidReason } });
}

export async function postTransaction(tenantId: string, transactionId: string, idempotencyKey = crypto.randomUUID()): Promise<FinanceTransactionRecord> {
  return appApiJson(`/api/backend/finance/transactions/${transactionId}/post`, { method: 'PATCH', tenantId, body: { idempotencyKey }, idempotencyKey });
}

export async function postCollectionToFinance(tenantId: string, payload: PostCollectionPayload): Promise<SourceCollectionPostingResult> {
  return appApiJson('/api/backend/finance/transactions/source-collections', { method: 'POST', tenantId, body: payload, idempotencyKey: payload.idempotencyKey });
}

export async function listLedgerEntries(tenantId: string, params: LedgerListParams = {}): Promise<PaginatedResult<LedgerEntryRecord>> {
  return appApiJson(`/api/backend/ledger${buildFinanceQuery(params)}`, { tenantId });
}

export async function listApprovals(tenantId: string, params: ApprovalListParams = {}, queue = false): Promise<PaginatedResult<ApprovalRecord>> {
  const path = queue ? '/api/backend/approvals/queue' : '/api/backend/approvals';
  return appApiJson(`${path}${buildFinanceQuery(params)}`, { tenantId });
}

export async function getApproval(tenantId: string, approvalId: string): Promise<ApprovalRecord> {
  return appApiJson(`/api/backend/approvals/${approvalId}`, { tenantId });
}

export async function getTransactionApprovalStatus(tenantId: string, transactionId: string): Promise<ApprovalStateRecord> {
  return appApiJson(`/api/backend/approvals/transactions/${transactionId}/status`, { tenantId });
}

export async function requestApproval(tenantId: string, transactionId: string, reason?: string, idempotencyKey = crypto.randomUUID()): Promise<ApprovalStateRecord> {
  return appApiJson(`/api/backend/approvals/transactions/${transactionId}/request`, { method: 'POST', tenantId, body: { reason, idempotencyKey }, idempotencyKey });
}

export async function approveApproval(tenantId: string, approvalId: string, decisionNote?: string): Promise<ApprovalRecord> {
  return appApiJson(`/api/backend/approvals/${approvalId}/approve`, { method: 'POST', tenantId, body: { decisionNote } });
}

export async function rejectApproval(tenantId: string, approvalId: string, decisionNote: string): Promise<ApprovalRecord> {
  return appApiJson(`/api/backend/approvals/${approvalId}/reject`, { method: 'POST', tenantId, body: { decisionNote } });
}

async function appApiJson<T>(path: string, options: { method?: string; tenantId: string; body?: unknown; idempotencyKey?: string }): Promise<T> {
  const response = await appApiRaw(path, { ...options, accept: 'application/json' });
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new ApiError(resolveMessage(payload, response.statusText), response.status, payload, response.headers.get('X-Request-Id') ?? undefined);
  }
  return payload as T;
}

async function appApiRaw(path: string, options: { method?: string; tenantId: string; body?: unknown; idempotencyKey?: string; accept: string }): Promise<Response> {
  const headers = new Headers();
  headers.set('Accept', options.accept);
  headers.set('X-Tenant-Id', options.tenantId);
  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey);
  }
  const init: RequestInit = { method: options.method ?? 'GET', credentials: 'include', headers };
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, init);
  if (!response.ok) {
    const requestId = response.headers.get('X-Request-Id') ?? undefined;
    const payload = await readPayload(response);
    throw new ApiError(resolveMessage(payload, response.statusText), response.status, payload, requestId);
  }
  return response;
}

async function readPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function resolveMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    return Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message : fallback;
  }
  return fallback || 'Request failed.';
}

function parseFileName(disposition: string | null): string | undefined {
  const match = disposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1];
}
