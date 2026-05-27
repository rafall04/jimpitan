/**
 * Purpose: Status and type badges for conservative finance, ledger, and approval screens.
 * Caller: Finance and approval list/detail pages.
 * Deps: Class name utility and finance status types.
 * MainFuncs: Converts backend enums into consistent labels and restrained color treatments.
 * SideEffects: None.
 */
import { cn } from '@/lib/utils/cn';
import { formatStatus } from '../workflow';
import type { ApprovalStatus, LedgerEntryType, TransactionStatus, TransactionType } from '../types';

type Tone = 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'submitted';

const toneClasses: Record<Tone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  active: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  danger: 'border-destructive/30 bg-destructive/10 text-destructive',
  submitted: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200',
};

export function TransactionStatusBadge({ status }: { status: TransactionStatus }) {
  const tone: Record<TransactionStatus, Tone> = {
    DRAFT: 'neutral',
    VALIDATED: 'submitted',
    PENDING_VALIDATION: 'warning',
    PENDING_APPROVAL: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    POSTED: 'success',
    VOIDED: 'neutral',
  };
  return <Badge label={formatStatus(status)} tone={tone[status]} />;
}

export function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const tone: Record<TransactionType, Tone> = {
    INCOME: 'success',
    EXPENSE: 'danger',
    TRANSFER: 'active',
    ADJUSTMENT: 'warning',
  };
  return <Badge label={formatStatus(type)} tone={tone[type]} />;
}

export function LedgerDirectionBadge({ direction }: { direction: LedgerEntryType }) {
  return <Badge label={formatStatus(direction)} tone={direction === 'INCREASE' ? 'success' : 'danger'} />;
}

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  const tone: Record<ApprovalStatus, Tone> = {
    PENDING: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'neutral',
  };
  return <Badge label={formatStatus(status)} tone={tone[status]} />;
}

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={cn('inline-flex min-h-7 items-center rounded-md border px-2 text-xs font-medium', toneClasses[tone])}>{label}</span>;
}
