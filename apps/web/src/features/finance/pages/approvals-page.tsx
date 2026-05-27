/**
 * Purpose: Tenant-aware expense approval queue page.
 * Caller: App Router /dashboard/approvals route.
 * Deps: Approval hooks, lifecycle controls, filters, RBAC context, and status badges.
 * MainFuncs: Lists approval queue rows, filters by status, and records approve/reject decisions with confirmations.
 * SideEffects: Performs tenant-scoped approval decision mutations through TanStack Query.
 */
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { ListSkeleton, PaginationControls, SearchField, SelectField } from '@/features/structure/components/list-shell';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { ApprovalLifecycleActions } from '../components/lifecycle-actions';
import { ApprovalStatusBadge, TransactionStatusBadge } from '../components/status-badge';
import { toUserMessage } from '../components/error-message';
import { useApprovalsQuery, useFinanceMutations } from '../hooks';
import { formatCurrencyAmount } from '../workflow';
import type { ApprovalStatus } from '../types';

export function ApprovalsPage() {
  const { permissions } = useTenantContext();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ApprovalStatus | ''>('PENDING');
  const query = useApprovalsQuery({ page, limit: 20, search, status: status || undefined, sortBy: 'createdAt', sortDirection: 'desc' }, true);
  const mutations = useFinanceMutations();

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Header title="Expense approvals" description="Review approval requests. Finance posting remains blocked until backend approval gates pass." />
      <section className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <SearchField label="Search approvals" placeholder="Search approval queue" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
        <SelectField id="approval-status-filter" label="Status" value={status} onChange={(value) => { setStatus(value as ApprovalStatus | ''); setPage(1); }}>
          <option value="">All</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </SelectField>
      </section>
      {query.isPending ? <ListSkeleton label="Loading approval queue" /> : null}
      {query.data?.items.length === 0 ? <EmptyState title="No approvals" description="Approval requests assigned to you will appear here." /> : null}
      <section className="rounded-lg border bg-card">
        <div className="divide-y">
          {query.data?.items.map((approval) => (
            <div key={approval.id} className="grid gap-3 p-4 xl:grid-cols-[8rem_minmax(0,1fr)_9rem_8rem_14rem] xl:items-center">
              <ApprovalStatusBadge status={approval.status} />
              <div>
                <Link href={`/dashboard/approvals/${approval.id}`} className="font-medium hover:underline">Expense approval</Link>
                <p className="text-sm text-muted-foreground">Approver: {approval.approver.fullName}</p>
                {approval.decisionNote ? <p className="mt-1 text-sm text-muted-foreground">{approval.decisionNote}</p> : null}
              </div>
              <span className="font-medium">{formatCurrencyAmount(approval.transaction.amount)}</span>
              <TransactionStatusBadge status={approval.transaction.status} />
              <ApprovalLifecycleActions
                approval={approval}
                permissions={permissions}
                isPending={mutations.approveApproval.isPending || mutations.rejectApproval.isPending}
                onApprove={(note) => void mutations.approveApproval.mutateAsync({ approvalId: approval.id, note }).catch((error) => toast.error(toUserMessage(error)))}
                onReject={(reason) => void mutations.rejectApproval.mutateAsync({ approvalId: approval.id, reason }).catch((error) => toast.error(toUserMessage(error)))}
              />
            </div>
          ))}
        </div>
      </section>
      {query.data ? <PaginationControls page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPageChange={setPage} /> : null}
    </main>
  );
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-primary">Approval workflow</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
