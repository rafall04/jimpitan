/**
 * Purpose: TanStack Query hooks for tenant-scoped finance, ledger, reports summary, and approvals workflows.
 * Caller: Finance dashboard, account/category/transaction/ledger pages, approval pages, and collection posting panel.
 * Deps: TanStack Query, sonner, tenant context, query keys, finance API adapter, and response types.
 * MainFuncs: Loads finance records and performs scoped mutations with invalidation after lifecycle changes.
 * SideEffects: Performs API calls, updates query cache, and shows non-sensitive toasts.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { queryKeys } from '@/lib/query/query-keys';
import {
  approveApproval,
  archiveCashAccount,
  archiveCategory,
  createCashAccount,
  createCategory,
  createReportExport,
  createTransactionDraft,
  downloadReportExport,
  getCashFlowSummary,
  getApproval,
  getFinanceSummary,
  getTransaction,
  getTransactionApprovalStatus,
  listApprovals,
  listCashAccounts,
  listCategories,
  listLedgerEntries,
  listReportExports,
  listTransactions,
  postCollectionToFinance,
  postTransaction,
  rejectApproval,
  rejectTransaction,
  requestApproval,
  retryReportExport,
  updateCashAccount,
  updateCategory,
  validateTransaction,
  voidTransaction,
} from './api';
import type {
  AccountListParams,
  ApprovalListParams,
  CategoryListParams,
  CreateCashAccountPayload,
  CreateCategoryPayload,
  CreateReportExportPayload,
  CreateTransactionPayload,
  LedgerListParams,
  PostCollectionPayload,
  ReportExportListParams,
  TransactionListParams,
  UpdateCashAccountPayload,
  UpdateCategoryPayload,
} from './types';

export function useAccountsQuery(params: AccountListParams = {}) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.finance.accounts(activeTenantId, params) : ['finance', 'accounts', 'disabled'],
    queryFn: () => listCashAccounts(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId),
  });
}

export function useCategoriesQuery(params: CategoryListParams = {}) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.finance.categories(activeTenantId, params) : ['finance', 'categories', 'disabled'],
    queryFn: () => listCategories(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId),
  });
}

export function useTransactionsQuery(params: TransactionListParams = {}) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.finance.transactions(activeTenantId, params) : ['finance', 'transactions', 'disabled'],
    queryFn: () => listTransactions(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId),
  });
}

export function useTransactionQuery(transactionId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && transactionId ? queryKeys.finance.transactionDetail(activeTenantId, transactionId) : ['finance', 'transaction', 'disabled'],
    queryFn: () => getTransaction(requiredTenant(activeTenantId), requiredId(transactionId)),
    enabled: Boolean(activeTenantId && transactionId),
  });
}

export function useLedgerQuery(params: LedgerListParams = {}) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.finance.ledger(activeTenantId, params) : ['finance', 'ledger', 'disabled'],
    queryFn: () => listLedgerEntries(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId),
  });
}

export function useFinanceSummaryQuery(params: { period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'; dateFrom?: string; dateTo?: string } = { period: 'MONTHLY' }) {
  const { activeTenantId, permissions } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.finance.reportSummary(activeTenantId, params) : ['finance', 'summary', 'disabled'],
    queryFn: () => getFinanceSummary(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId && permissions.has('reports.private.read')),
    retry: false,
  });
}

export function useCashFlowSummaryQuery(params: { period?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'CUSTOM'; dateFrom?: string; dateTo?: string } = { period: 'MONTHLY' }) {
  const { activeTenantId, permissions } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? [...queryKeys.finance.reportSummary(activeTenantId, params), 'cash-flow'] : ['finance', 'cash-flow', 'disabled'],
    queryFn: () => getCashFlowSummary(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId && permissions.has('reports.private.read')),
    retry: false,
  });
}

export function useReportExportsQuery(params: ReportExportListParams = { page: 1, limit: 5 }) {
  const { activeTenantId, permissions } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? queryKeys.reports.exports(activeTenantId, params) : ['reports', 'exports', 'disabled'],
    queryFn: () => listReportExports(requiredTenant(activeTenantId), params),
    enabled: Boolean(activeTenantId && permissions.has('reports.export')),
    retry: false,
  });
}

export function useApprovalsQuery(params: ApprovalListParams = {}, queue = false) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId ? (queue ? queryKeys.approvals.queue(activeTenantId, params) : queryKeys.approvals.list(activeTenantId, params)) : ['approvals', 'disabled'],
    queryFn: () => listApprovals(requiredTenant(activeTenantId), params, queue),
    enabled: Boolean(activeTenantId),
  });
}

export function useApprovalQuery(approvalId: string | null) {
  const { activeTenantId } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && approvalId ? queryKeys.approvals.detail(activeTenantId, approvalId) : ['approvals', 'detail', 'disabled'],
    queryFn: () => getApproval(requiredTenant(activeTenantId), requiredId(approvalId)),
    enabled: Boolean(activeTenantId && approvalId),
  });
}

export function useTransactionApprovalStatusQuery(transactionId: string | null) {
  const { activeTenantId, permissions } = useTenantContext();
  return useQuery({
    queryKey: activeTenantId && transactionId ? queryKeys.approvals.transactionStatus(activeTenantId, transactionId) : ['approvals', 'transaction-status', 'disabled'],
    queryFn: () => getTransactionApprovalStatus(requiredTenant(activeTenantId), requiredId(transactionId)),
    enabled: Boolean(activeTenantId && transactionId && (permissions.has('approvals.read') || permissions.has('transactions.read'))),
    retry: false,
  });
}

export function useFinanceMutations() {
  const { activeTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const invalidateFinance = async () => {
    const tenantId = requiredTenant(activeTenantId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.scope(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.scope(tenantId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.jimpitan.scope(tenantId) }),
    ]);
  };

  const invalidateTransaction = async (transactionId: string) => {
    const tenantId = requiredTenant(activeTenantId);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.transactionDetail(tenantId, transactionId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.transactionStatus(tenantId, transactionId) }),
      invalidateFinance(),
    ]);
  };

  return {
    createAccount: useMutation({
      mutationFn: (payload: CreateCashAccountPayload) => createCashAccount(requiredTenant(activeTenantId), payload),
      onSuccess: async () => {
        await invalidateFinance();
        toast.success('Cash account saved');
      },
    }),
    updateAccount: useMutation({
      mutationFn: ({ accountId, payload }: { accountId: string; payload: UpdateCashAccountPayload }) => updateCashAccount(requiredTenant(activeTenantId), accountId, payload),
      onSuccess: async () => {
        await invalidateFinance();
        toast.success('Cash account updated');
      },
    }),
    archiveAccount: useMutation({
      mutationFn: ({ accountId, reason }: { accountId: string; reason: string }) => archiveCashAccount(requiredTenant(activeTenantId), accountId, reason),
      onSuccess: async () => {
        await invalidateFinance();
        toast.success('Cash account archived');
      },
    }),
    createCategory: useMutation({
      mutationFn: (payload: CreateCategoryPayload) => createCategory(requiredTenant(activeTenantId), payload),
      onSuccess: async () => {
        await invalidateFinance();
        toast.success('Category saved');
      },
    }),
    updateCategory: useMutation({
      mutationFn: ({ categoryId, payload }: { categoryId: string; payload: UpdateCategoryPayload }) => updateCategory(requiredTenant(activeTenantId), categoryId, payload),
      onSuccess: async () => {
        await invalidateFinance();
        toast.success('Category updated');
      },
    }),
    archiveCategory: useMutation({
      mutationFn: ({ categoryId, reason }: { categoryId: string; reason: string }) => archiveCategory(requiredTenant(activeTenantId), categoryId, reason),
      onSuccess: async () => {
        await invalidateFinance();
        toast.success('Category archived');
      },
    }),
    createTransaction: useMutation({
      mutationFn: ({ type, payload }: { type: 'income' | 'expense'; payload: CreateTransactionPayload }) => createTransactionDraft(requiredTenant(activeTenantId), type, payload),
      onSuccess: async () => {
        await invalidateFinance();
        toast.success('Transaction draft created');
      },
    }),
    validateTransaction: useMutation({
      mutationFn: ({ transactionId, note }: { transactionId: string; note?: string }) => validateTransaction(requiredTenant(activeTenantId), transactionId, note),
      onSuccess: async (transaction) => {
        await invalidateTransaction(transaction.id);
        toast.success('Transaction validated');
      },
    }),
    rejectTransaction: useMutation({
      mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => rejectTransaction(requiredTenant(activeTenantId), transactionId, reason),
      onSuccess: async (transaction) => {
        await invalidateTransaction(transaction.id);
        toast.success('Transaction rejected');
      },
    }),
    voidTransaction: useMutation({
      mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => voidTransaction(requiredTenant(activeTenantId), transactionId, reason),
      onSuccess: async (transaction) => {
        await invalidateTransaction(transaction.id);
        toast.success('Draft voided');
      },
    }),
    postTransaction: useMutation({
      mutationFn: (transactionId: string) => postTransaction(requiredTenant(activeTenantId), transactionId),
      onSuccess: async (transaction) => {
        await invalidateTransaction(transaction.id);
        toast.success('Transaction posted');
      },
    }),
    postCollection: useMutation({
      mutationFn: (payload: PostCollectionPayload) => postCollectionToFinance(requiredTenant(activeTenantId), payload),
      onSuccess: async (result) => {
        await invalidateTransaction(result.transaction.id);
        toast.success('Collection posted to finance');
      },
    }),
    requestApproval: useMutation({
      mutationFn: ({ transactionId, reason }: { transactionId: string; reason?: string }) => requestApproval(requiredTenant(activeTenantId), transactionId, reason),
      onSuccess: async (state) => {
        await invalidateTransaction(state.transactionId);
        toast.success('Approval requested');
      },
    }),
    approveApproval: useMutation({
      mutationFn: ({ approvalId, note }: { approvalId: string; note?: string }) => approveApproval(requiredTenant(activeTenantId), approvalId, note),
      onSuccess: async (approval) => {
        await invalidateTransaction(approval.transactionId);
        toast.success('Approval recorded');
      },
    }),
    rejectApproval: useMutation({
      mutationFn: ({ approvalId, reason }: { approvalId: string; reason: string }) => rejectApproval(requiredTenant(activeTenantId), approvalId, reason),
      onSuccess: async (approval) => {
        await invalidateTransaction(approval.transactionId);
        toast.success('Approval rejected');
      },
    }),
  };
}

export function useReportExportMutations() {
  const { activeTenantId } = useTenantContext();
  const queryClient = useQueryClient();

  const invalidateExports = async () => {
    const tenantId = requiredTenant(activeTenantId);
    await queryClient.invalidateQueries({ queryKey: queryKeys.reports.scope(tenantId) });
  };

  return {
    createExport: useMutation({
      mutationFn: (payload: CreateReportExportPayload) => createReportExport(requiredTenant(activeTenantId), payload),
      onSuccess: async () => {
        await invalidateExports();
        toast.success('Export request created');
      },
    }),
    retryExport: useMutation({
      mutationFn: (exportId: string) => retryReportExport(requiredTenant(activeTenantId), exportId),
      onSuccess: async () => {
        await invalidateExports();
        toast.success('Export retry started');
      },
    }),
    downloadExport: useMutation({
      mutationFn: (exportId: string) => downloadReportExport(requiredTenant(activeTenantId), exportId),
    }),
  };
}

function requiredTenant(activeTenantId: string | undefined): string {
  if (!activeTenantId) {
    throw new Error('Active tenant is required.');
  }
  return activeTenantId;
}

function requiredId(id: string | null): string {
  if (!id) {
    throw new Error('Record id is required.');
  }
  return id;
}
