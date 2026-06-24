/**
 * Purpose: Tenant-aware finance transaction list and draft creation workspace.
 * Caller: App Router /dashboard/finance/transactions route.
 * Deps: Finance hooks, transaction form, lifecycle controls, filters, RBAC context, and status badges.
 * MainFuncs: Lists/searches transactions, creates income/expense drafts, and exposes lifecycle actions with confirmation.
 * SideEffects: Performs tenant-scoped transaction mutations through TanStack Query.
 */
'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ListSkeleton, PaginationControls, SearchField, SelectField } from '@/features/structure/components/list-shell';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { TransactionForm } from '../components/finance-form';
import { TransactionLifecycleActions } from '../components/lifecycle-actions';
import { TransactionStatusBadge, TransactionTypeBadge } from '../components/status-badge';
import { toUserMessage } from '../components/error-message';
import { formatCurrencyAmount } from '../workflow';
import { toTransactionPayload, type TransactionValues } from '../schemas';
import { useAccountsQuery, useCategoriesQuery, useFinanceMutations, useTransactionsQuery } from '../hooks';
import type { TransactionStatus, TransactionType } from '../types';

export function TransactionsPage() {
  const { permissions } = useTenantContext();
  const canCreate = permissions.has('transactions.create');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TransactionStatus | ''>('');
  const [type, setType] = useState<Extract<TransactionType, 'INCOME' | 'EXPENSE' | 'ADJUSTMENT'> | ''>('');
  const [draftType, setDraftType] = useState<'income' | 'expense' | null>(null);
  const query = useTransactionsQuery({ page, limit: 20, search, status: status || undefined, type: type || undefined, sortBy: 'transactionDate', sortDirection: 'desc' });
  const accountsQuery = useAccountsQuery({ page: 1, limit: 100, isActive: true, sortBy: 'name', sortDirection: 'asc' });
  const categoriesQuery = useCategoriesQuery({ page: 1, limit: 100, type: draftType === 'income' ? 'INCOME' : draftType === 'expense' ? 'EXPENSE' : undefined, isActive: true, sortBy: 'name', sortDirection: 'asc' });
  const mutations = useFinanceMutations();

  async function create(values: TransactionValues) {
    if (!draftType) return;
    try {
      await mutations.createTransaction.mutateAsync({ type: draftType, payload: toTransactionPayload(values) });
      setDraftType(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Header
        title="Transaksi"
        description="Buat draf, validasi, setujui bila diperlukan, dan posting transaksi ke buku besar yang bersifat append-only."
        action={canCreate ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setDraftType('income')}><Plus className="h-4 w-4" aria-hidden="true" />Pemasukan</Button>
            <Button type="button" onClick={() => setDraftType('expense')}><Plus className="h-4 w-4" aria-hidden="true" />Pengeluaran</Button>
          </div>
        ) : null}
      />
      <section className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <SearchField label="Cari transaksi" placeholder="Cari keterangan atau referensi" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
        <SelectField id="transaction-status-filter" label="Status" value={status} onChange={(value) => { setStatus(value as TransactionStatus | ''); setPage(1); }}>
          <option value="">Semua</option>
          <option value="DRAFT">Draf</option>
          <option value="VALIDATED">Tervalidasi</option>
          <option value="PENDING_APPROVAL">Menunggu persetujuan</option>
          <option value="APPROVED">Disetujui</option>
          <option value="POSTED">Terposting</option>
          <option value="REJECTED">Ditolak</option>
          <option value="VOIDED">Dibatalkan</option>
        </SelectField>
        <SelectField id="transaction-type-filter" label="Jenis" value={type} onChange={(value) => { setType(value as never); setPage(1); }}>
          <option value="">Semua</option>
          <option value="INCOME">Pemasukan</option>
          <option value="EXPENSE">Pengeluaran</option>
          <option value="ADJUSTMENT">Penyesuaian</option>
        </SelectField>
      </section>
      {query.isPending ? <ListSkeleton label="Memuat transaksi" /> : null}
      {query.data?.items.length === 0 ? <EmptyState title="Belum ada transaksi" description="Buat draf pemasukan atau pengeluaran untuk memulai alur keuangan." /> : null}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {query.data?.items.map((transaction) => (
            <div key={transaction.id} className="grid gap-3 p-4 xl:grid-cols-[8rem_8rem_minmax(0,1fr)_9rem_18rem] xl:items-center">
              <TransactionTypeBadge type={transaction.type} />
              <TransactionStatusBadge status={transaction.status} />
              <div>
                <Link href={`/dashboard/finance/transactions/${transaction.id}`} className="font-medium hover:underline">{transaction.description}</Link>
                <p className="text-sm text-muted-foreground">{transaction.category.name} - {transaction.cashAccount.name}</p>
                {transaction.rejectionReason ? <p className="mt-1 text-sm text-destructive">{transaction.rejectionReason}</p> : null}
              </div>
              <p className="font-medium">{formatCurrencyAmount(transaction.amount)}</p>
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
          ))}
        </div>
      </div>
      {query.data ? <PaginationControls page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPageChange={setPage} /> : null}
      <Sheet open={Boolean(draftType)} onOpenChange={(open) => !open && setDraftType(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:w-[34rem]">
          <SheetHeader>
            <SheetTitle>{draftType === 'income' ? 'Draf pemasukan' : 'Draf pengeluaran'}</SheetTitle>
            <SheetDescription>Draf memerlukan validasi backend sebelum diposting. Gerbang persetujuan berlaku untuk pengeluaran bila kebijakan mensyaratkannya.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TransactionForm
              key={`${draftType}-${accountsQuery.data?.items[0]?.id ?? ''}-${categoriesQuery.data?.items[0]?.id ?? ''}`}
              type={draftType ?? 'expense'}
              accounts={accountsQuery.data?.items ?? []}
              categories={categoriesQuery.data?.items ?? []}
              isPending={mutations.createTransaction.isPending}
              onSubmit={create}
              onCancel={() => setDraftType(null)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Header({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Keuangan</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
