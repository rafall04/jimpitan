/**
 * Purpose: Pure finance and approval workflow helpers for conservative UI action visibility.
 * Caller: Finance pages, approval pages, status components, and unit tests.
 * Deps: Finance contract types.
 * MainFuncs: Computes immutable state, transaction actions, approval actions, status labels, and currency display.
 * SideEffects: None.
 */
import type { ApprovalRecord, FinanceTransactionRecord, TransactionStatus } from './types';

export type TransactionAction = 'validate' | 'reject' | 'void' | 'post';
export type ApprovalAction = 'approve' | 'reject';

export function isPostedTransactionImmutable(transaction: FinanceTransactionRecord): boolean {
  return transaction.status === 'POSTED';
}

export function getTransactionActions(transaction: FinanceTransactionRecord, permissions: ReadonlySet<string>): TransactionAction[] {
  if (transaction.status === 'POSTED' || transaction.status === 'VOIDED' || transaction.status === 'REJECTED') {
    return [];
  }
  const actions: TransactionAction[] = [];
  if (transaction.status === 'DRAFT' && permissions.has('transactions.validate')) {
    actions.push('validate', 'reject');
  }
  if (transaction.status === 'DRAFT' && permissions.has('transactions.delete')) {
    actions.push('void');
  }
  if ((transaction.status === 'VALIDATED' || transaction.status === 'APPROVED') && permissions.has('transactions.post')) {
    actions.push('post');
  }
  return actions;
}

export function getApprovalActions(approval: ApprovalRecord, permissions: ReadonlySet<string>): ApprovalAction[] {
  if (approval.status !== 'PENDING' || !permissions.has('approvals.decide')) {
    return [];
  }
  return ['approve', 'reject'];
}

export function isApprovalBlockingStatus(status: TransactionStatus): boolean {
  return status === 'PENDING_APPROVAL';
}

export function formatCurrencyAmount(value: string | number): string {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(numberValue)) {
    return 'Rp0';
  }
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(numberValue);
}

export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((part) => `${part[0]}${part.slice(1).toLowerCase()}`)
    .join(' ');
}
