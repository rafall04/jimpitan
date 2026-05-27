/**
 * Purpose: Tenant-aware finance transaction detail page.
 * Caller: App Router /dashboard/finance/transactions/[id] route.
 * Deps: Finance hooks, lifecycle controls, approval status hook, status badges, and metric widgets.
 * MainFuncs: Shows immutable posted state, lifecycle metadata, ledger row, approval state, and backend rejection reasons.
 * SideEffects: Performs tenant-scoped lifecycle and approval request mutations.
 */
'use client';

import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/feedback/empty-state';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { AmountMetric, Metric } from '../components/metric';
import { LedgerDirectionBadge, ApprovalStatusBadge, TransactionStatusBadge, TransactionTypeBadge } from '../components/status-badge';
import { TransactionLifecycleActions } from '../components/lifecycle-actions';
import { toUserMessage } from '../components/error-message';
import { useFinanceMutations, useTransactionApprovalStatusQuery, useTransactionQuery } from '../hooks';
import { formatCurrencyAmount, isApprovalBlockingStatus, isPostedTransactionImmutable } from '../workflow';

export function TransactionDetailPage({ transactionId }: { transactionId: string }) {
  const { permissions } = useTenantContext();
  const query = useTransactionQuery(transactionId);
  const approvalQuery = useTransactionApprovalStatusQuery(transactionId);
  const mutations = useFinanceMutations();
  const transaction = query.data;

  if (query.isPending) {
    return <DetailSkeleton />;
  }

  if (query.isError || !transaction) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState title="Transaction unavailable" description="The transaction could not be loaded for this tenant." />
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 px-0">
            <Link href="/dashboard/finance/transactions"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Transactions</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">{transaction.description}</h1>
            <TransactionStatusBadge status={transaction.status} />
            <TransactionTypeBadge type={transaction.type} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{transaction.category.name} - {transaction.cashAccount.name}</p>
        </div>
        <TransactionLifecycleActions
          transaction={transaction}
          permissions={permissions}
          isPending={mutations.validateTransaction.isPending || mutations.rejectTransaction.isPending || mutations.voidTransaction.isPending || mutations.postTransaction.isPending}
          onValidate={(note) => void mutations.validateTransaction.mutateAsync({ transactionId: transaction.id, note }).catch((error) => toast.error(toUserMessage(error)))}
          onReject={(reason) => void mutations.rejectTransaction.mutateAsync({ transactionId: transaction.id, reason }).catch((error) => toast.error(toUserMessage(error)))}
          onVoid={(reason) => void mutations.voidTransaction.mutateAsync({ transactionId: transaction.id, reason }).catch((error) => toast.error(toUserMessage(error)))}
          onPost={() => void mutations.postTransaction.mutateAsync(transaction.id).catch((error) => toast.error(toUserMessage(error)))}
        />
      </div>

      {isPostedTransactionImmutable(transaction) ? (
        <section className="flex items-start gap-3 rounded-lg border bg-card p-4">
          <Lock className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Posted transaction is immutable</p>
            <p className="text-sm text-muted-foreground">Corrections must be made through backend-controlled adjustment transactions.</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        <AmountMetric label="Amount" amount={transaction.amount} />
        <Metric label="Date" value={new Date(transaction.transactionDate).toLocaleDateString('id-ID')} />
        <Metric label="Account" value={transaction.cashAccount.name} />
        <Metric label="Category" value={transaction.category.name} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Lifecycle details</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <DetailTerm label="Created" value={new Date(transaction.createdAt).toLocaleString('id-ID')} />
            <DetailTerm label="Updated" value={new Date(transaction.updatedAt).toLocaleString('id-ID')} />
            <DetailTerm label="Validated" value={transaction.validatedAt ? new Date(transaction.validatedAt).toLocaleString('id-ID') : '-'} />
            <DetailTerm label="Posted" value={transaction.postedAt ? new Date(transaction.postedAt).toLocaleString('id-ID') : '-'} />
            <DetailTerm label="Reference" value={transaction.referenceNumber ?? '-'} />
            <DetailTerm label="Source collection" value={transaction.sourceCollectionId ?? '-'} />
          </dl>
          {transaction.validationNote ? <p className="mt-4 rounded-md border p-3 text-sm">{transaction.validationNote}</p> : null}
          {transaction.rejectionReason ? <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{transaction.rejectionReason}</p> : null}
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-base font-semibold">Approval state</h2>
            {approvalQuery.isPending && isApprovalBlockingStatus(transaction.status) ? <Skeleton className="mt-3 h-20 w-full" /> : null}
            {approvalQuery.data ? (
              <div className="mt-3 space-y-3 text-sm">
                <p>Status: {approvalQuery.data.status}</p>
                <p>{approvalQuery.data.approvedCount}/{approvalQuery.data.requiredApprovals} approved</p>
                {approvalQuery.data.approvals.map((approval) => (
                  <Link key={approval.id} href={`/dashboard/approvals/${approval.id}`} className="flex items-center justify-between rounded-md border p-3 hover:bg-muted">
                    <span>{approval.approver.fullName}</span>
                    <ApprovalStatusBadge status={approval.status} />
                  </Link>
                ))}
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">No approval status is available for this transaction.</p>}
            {transaction.type === 'EXPENSE' && transaction.status === 'VALIDATED' && permissions.has('transactions.validate') ? (
              <Button type="button" variant="outline" className="mt-3 w-full" disabled={mutations.requestApproval.isPending} onClick={() => void mutations.requestApproval.mutateAsync({ transactionId: transaction.id }).catch((error) => toast.error(toUserMessage(error)))}>
                Request approval
              </Button>
            ) : null}
          </section>

          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-base font-semibold">Ledger entry</h2>
            {transaction.ledger ? (
              <div className="mt-3 space-y-3 text-sm">
                <LedgerDirectionBadge direction={transaction.ledger.entryType} />
                <p>Sequence #{transaction.ledger.ledgerSequence}</p>
                <p>Amount {formatCurrencyAmount(transaction.ledger.amount)}</p>
                <p>Balance after {formatCurrencyAmount(transaction.ledger.balanceAfter)}</p>
              </div>
            ) : <p className="mt-3 text-sm text-muted-foreground">Ledger entry is created only after posting.</p>}
          </section>
        </aside>
      </div>
    </main>
  );
}

function DetailTerm({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-80 w-full" />
    </main>
  );
}
