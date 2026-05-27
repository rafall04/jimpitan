/**
 * Purpose: Tenant-aware cash account management page.
 * Caller: App Router /dashboard/finance/accounts route.
 * Deps: Finance hooks, account form, confirmation dialog, RBAC context, and list shell components.
 * MainFuncs: Lists cash accounts, creates accounts, toggles active state, and archives with explicit reasons.
 * SideEffects: Performs tenant-scoped account mutations through TanStack Query.
 */
'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ListSkeleton, PaginationControls, SearchField, SelectField } from '@/features/structure/components/list-shell';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { AccountForm } from '../components/finance-form';
import { AmountMetric } from '../components/metric';
import { ConfirmDialog } from '../components/confirm-dialog';
import { toUserMessage } from '../components/error-message';
import { toAccountPayload, type AccountValues } from '../schemas';
import { useAccountsQuery, useFinanceMutations } from '../hooks';
import type { CashAccountRecord } from '../types';

export function AccountsPage() {
  const { permissions } = useTenantContext();
  const canCreate = permissions.has('transactions.create');
  const canUpdate = permissions.has('transactions.update');
  const canArchive = permissions.has('transactions.delete');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<CashAccountRecord | null>(null);
  const query = useAccountsQuery({ page, limit: 20, search, isActive: active === '' ? undefined : active === 'true', sortBy: 'name', sortDirection: 'asc' });
  const mutations = useFinanceMutations();

  async function create(values: AccountValues) {
    try {
      await mutations.createAccount.mutateAsync(toAccountPayload(values));
      setSheetOpen(false);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function toggle(account: CashAccountRecord) {
    try {
      await mutations.updateAccount.mutateAsync({ accountId: account.id, payload: { isActive: !account.isActive } });
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function archive(reason?: string) {
    if (!archiveTarget || !reason) return;
    try {
      await mutations.archiveAccount.mutateAsync({ accountId: archiveTarget.id, reason });
      setArchiveTarget(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Header title="Cash accounts" description="Manage tenant cash accounts. Ledger entries remain append-only after posting." action={canCreate ? <Button onClick={() => setSheetOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" />New account</Button> : null} />
      <section className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <SearchField label="Search accounts" placeholder="Search account" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
        <SelectField id="account-active-filter" label="Status" value={active} onChange={(value) => { setActive(value); setPage(1); }}>
          <option value="">All</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </SelectField>
      </section>
      {query.isPending ? <ListSkeleton label="Loading cash accounts" /> : null}
      {query.data?.items.length === 0 ? <EmptyState title="No cash accounts" description="Create a cash account before drafting transactions." /> : null}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {query.data?.items.map((account) => (
          <section key={account.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{account.name}</h2>
                <p className="text-sm text-muted-foreground">{account.key} - {account.currency}</p>
              </div>
              <span className="rounded-md border px-2 py-1 text-xs">{account.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="mt-4">
              <AmountMetric label="Current balance" amount={account.currentBalance} detail="Backend-managed display value" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canUpdate ? <Button type="button" size="sm" variant="outline" onClick={() => void toggle(account)}>{account.isActive ? 'Deactivate' : 'Reactivate'}</Button> : null}
              {canArchive ? <Button type="button" size="sm" variant="destructive" onClick={() => setArchiveTarget(account)}>Archive</Button> : null}
            </div>
          </section>
        ))}
      </div>
      {query.data ? <PaginationControls page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPageChange={setPage} /> : null}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:w-[32rem]">
          <SheetHeader>
            <SheetTitle>New cash account</SheetTitle>
            <SheetDescription>Create a tenant-scoped account for future ledger postings.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <AccountForm isPending={mutations.createAccount.isPending} onSubmit={create} onCancel={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={Boolean(archiveTarget)} title="Archive cash account" description="Accounts with posted ledger entries may be blocked by backend safety rules. Provide a reason." destructive reasonRequired onOpenChange={(open) => !open && setArchiveTarget(null)} onConfirm={(reason) => void archive(reason)} />
    </main>
  );
}

function Header({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-medium text-primary">Finance setup</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
