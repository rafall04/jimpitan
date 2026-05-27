/**
 * Purpose: Tenant-aware read-only append ledger page.
 * Caller: App Router /dashboard/finance/ledger route.
 * Deps: Finance ledger hook, account filters, status badges, metrics, and pagination components.
 * MainFuncs: Lists ledger sequence, direction, amount, balanceAfter, cash account id, posted date, and source transaction link.
 * SideEffects: None beyond tenant-scoped read requests.
 */
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { ListSkeleton, PaginationControls, SelectField } from '@/features/structure/components/list-shell';
import { LedgerDirectionBadge } from '../components/status-badge';
import { useAccountsQuery, useLedgerQuery } from '../hooks';
import { formatCurrencyAmount } from '../workflow';

export function LedgerPage() {
  const [page, setPage] = useState(1);
  const [accountId, setAccountId] = useState('');
  const accountsQuery = useAccountsQuery({ page: 1, limit: 100, sortBy: 'name', sortDirection: 'asc' });
  const ledgerQuery = useLedgerQuery({ page, limit: 25, cashAccountId: accountId || undefined, sortDirection: 'desc' });

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Header title="Cash ledger" description="Read-only append ledger. Rows are created only by backend posting transactions." />
      <section className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[20rem]">
        <SelectField id="ledger-account-filter" label="Cash account" value={accountId} onChange={(value) => { setAccountId(value); setPage(1); }}>
          <option value="">All accounts</option>
          {accountsQuery.data?.items.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </SelectField>
      </section>
      {ledgerQuery.isPending ? <ListSkeleton label="Loading ledger entries" /> : null}
      {ledgerQuery.data?.items.length === 0 ? <EmptyState title="No ledger entries" description="Validated transactions appear here after posting." /> : null}
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-[6rem_7rem_minmax(0,1fr)_9rem_9rem_10rem] gap-3 border-b p-4 text-xs font-medium uppercase tracking-normal text-muted-foreground md:grid">
          <span>Sequence</span>
          <span>Direction</span>
          <span>Transaction</span>
          <span>Amount</span>
          <span>Balance</span>
          <span>Posted</span>
        </div>
        <div className="divide-y">
          {ledgerQuery.data?.items.map((entry) => (
            <div key={entry.id} className="grid gap-2 p-4 text-sm md:grid-cols-[6rem_7rem_minmax(0,1fr)_9rem_9rem_10rem] md:items-center">
              <span className="font-medium">#{entry.ledgerSequence}</span>
              <LedgerDirectionBadge direction={entry.entryType} />
              <Link href={`/dashboard/finance/transactions/${entry.transactionId}`} className="hover:underline">{entry.transactionId}</Link>
              <span>{formatCurrencyAmount(entry.amount)}</span>
              <span>{formatCurrencyAmount(entry.balanceAfter)}</span>
              <span className="text-muted-foreground">{new Date(entry.ledgerDate).toLocaleDateString('id-ID')}</span>
            </div>
          ))}
        </div>
      </section>
      {ledgerQuery.data ? <PaginationControls page={ledgerQuery.data.page} totalPages={ledgerQuery.data.totalPages} total={ledgerQuery.data.total} onPageChange={setPage} /> : null}
    </main>
  );
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-primary">Ledger</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-normal">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
