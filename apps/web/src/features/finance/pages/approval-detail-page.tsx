/**
 * Purpose: Tenant-aware expense approval detail page.
 * Caller: App Router /dashboard/approvals/[id] route.
 * Deps: Approval hook, finance mutations, lifecycle controls, status badges, and metrics.
 * MainFuncs: Shows approval request context, decision timeline, transaction link, and approve/reject actions.
 * SideEffects: Performs tenant-scoped approval decision mutations through TanStack Query.
 */
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/feedback/empty-state';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { AmountMetric, Metric } from '../components/metric';
import { ApprovalLifecycleActions } from '../components/lifecycle-actions';
import { ApprovalStatusBadge, TransactionStatusBadge, TransactionTypeBadge } from '../components/status-badge';
import { toUserMessage } from '../components/error-message';
import { useApprovalQuery, useFinanceMutations } from '../hooks';

export function ApprovalDetailPage({ approvalId }: { approvalId: string }) {
  const { permissions } = useTenantContext();
  const query = useApprovalQuery(approvalId);
  const mutations = useFinanceMutations();
  const approval = query.data;

  if (query.isPending) {
    return <DetailSkeleton />;
  }

  if (query.isError || !approval) {
    return (
      <main id="main-content" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState title="Approval unavailable" description="The approval request could not be loaded for this tenant." />
      </main>
    );
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 px-0">
            <Link href="/dashboard/approvals"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Approvals</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal">Expense approval</h1>
            <ApprovalStatusBadge status={approval.status} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Assigned to {approval.approver.fullName}</p>
        </div>
        <ApprovalLifecycleActions
          approval={approval}
          permissions={permissions}
          isPending={mutations.approveApproval.isPending || mutations.rejectApproval.isPending}
          onApprove={(note) => void mutations.approveApproval.mutateAsync({ approvalId: approval.id, note }).catch((error) => toast.error(toUserMessage(error)))}
          onReject={(reason) => void mutations.rejectApproval.mutateAsync({ approvalId: approval.id, reason }).catch((error) => toast.error(toUserMessage(error)))}
        />
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <AmountMetric label="Amount" amount={approval.transaction.amount} />
        <Metric label="Requested" value={new Date(approval.createdAt).toLocaleDateString('id-ID')} />
        <Metric label="Decided" value={approval.decidedAt ? new Date(approval.decidedAt).toLocaleDateString('id-ID') : '-'} />
        <Metric label="Expires" value={approval.expiresAt ? new Date(approval.expiresAt).toLocaleDateString('id-ID') : '-'} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Decision context</h2>
          <div className="mt-4 space-y-3 text-sm">
            {approval.reason ? <p className="rounded-md border p-3">{approval.reason}</p> : <p className="text-muted-foreground">No request reason was provided.</p>}
            {approval.decisionNote ? <p className="rounded-md border p-3">{approval.decisionNote}</p> : null}
          </div>
          <ol className="mt-5 space-y-3">
            <TimelineItem label="Approval requested" date={approval.createdAt} />
            {approval.decidedAt ? <TimelineItem label={`Decision ${approval.status.toLowerCase()}`} date={approval.decidedAt} /> : null}
            <TimelineItem label="Last updated" date={approval.updatedAt} />
          </ol>
        </section>

        <aside className="rounded-lg border bg-card p-4">
          <h2 className="text-base font-semibold">Source transaction</h2>
          <div className="mt-3 space-y-3 text-sm">
            <TransactionTypeBadge type={approval.transaction.type} />
            <TransactionStatusBadge status={approval.transaction.status} />
            <Button asChild variant="outline" className="w-full">
              <Link href={`/dashboard/finance/transactions/${approval.transactionId}`}>Open transaction</Link>
            </Button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function TimelineItem({ label, date }: { label: string; date: string }) {
  return (
    <li className="border-l-2 border-muted pl-3">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{new Date(date).toLocaleString('id-ID')}</p>
    </li>
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
