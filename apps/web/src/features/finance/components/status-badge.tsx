/**
 * Purpose: Status and type badges for conservative finance, ledger, and approval screens.
 * Caller: Finance and approval list/detail pages.
 * Deps: Shared Badge primitive and finance status types.
 * MainFuncs: Converts backend enums into consistent Indonesian labels and semantic badge variants.
 * SideEffects: None.
 */
import React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { ApprovalStatus, ApprovalWorkflowStatus, LedgerEntryType, TransactionStatus, TransactionType } from '../types';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const transactionStatusLabels: Record<TransactionStatus, string> = {
  DRAFT: 'Draf',
  VALIDATED: 'Tervalidasi',
  PENDING_VALIDATION: 'Menunggu validasi',
  PENDING_APPROVAL: 'Menunggu persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  POSTED: 'Terposting',
  VOIDED: 'Dibatalkan',
};

const transactionStatusVariants: Record<TransactionStatus, BadgeVariant> = {
  DRAFT: 'secondary',
  VALIDATED: 'success',
  PENDING_VALIDATION: 'gold',
  PENDING_APPROVAL: 'gold',
  APPROVED: 'success',
  REJECTED: 'destructive',
  POSTED: 'success',
  VOIDED: 'secondary',
};

const transactionTypeLabels: Record<TransactionType, string> = {
  INCOME: 'Pemasukan',
  EXPENSE: 'Pengeluaran',
  TRANSFER: 'Transfer',
  ADJUSTMENT: 'Penyesuaian',
};

const transactionTypeVariants: Record<TransactionType, BadgeVariant> = {
  INCOME: 'success',
  EXPENSE: 'destructive',
  TRANSFER: 'default',
  ADJUSTMENT: 'secondary',
};

const approvalStatusLabels: Record<ApprovalWorkflowStatus, string> = {
  NOT_REQUIRED: 'Tidak diperlukan',
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
  EXPIRED: 'Kedaluwarsa',
};

const approvalStatusVariants: Record<ApprovalWorkflowStatus, BadgeVariant> = {
  NOT_REQUIRED: 'outline',
  PENDING: 'gold',
  APPROVED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
  EXPIRED: 'secondary',
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  return <Badge variant={transactionStatusVariants[status]}>{transactionStatusLabels[status]}</Badge>;
}

export function TransactionTypeBadge({ type }: { type: TransactionType }) {
  return <Badge variant={transactionTypeVariants[type]}>{transactionTypeLabels[type]}</Badge>;
}

export function LedgerDirectionBadge({ direction }: { direction: LedgerEntryType }) {
  return (
    <Badge variant={direction === 'INCREASE' ? 'success' : 'destructive'}>{direction === 'INCREASE' ? 'Kas masuk' : 'Kas keluar'}</Badge>
  );
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus | ApprovalWorkflowStatus }) {
  return <Badge variant={approvalStatusVariants[status]}>{approvalStatusLabels[status]}</Badge>;
}
