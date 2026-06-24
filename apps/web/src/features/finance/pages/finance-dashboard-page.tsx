/**
 * Purpose: Tenant-aware finance dashboard with ledger-derived summary and operational queues.
 * Caller: App Router /dashboard/finance route.
 * Deps: Finance hooks, Jimpitan collection hook, metric/status components, tenant permissions, and mutation helpers.
 * MainFuncs: Shows cash balances, income/expense totals, report exports, pending finance/approval work, recent ledger rows, and mode-aware collection posting panel.
 * SideEffects: Posts validated Jimpitan collections and creates/downloads report exports through backend endpoints.
 */
'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTenantContext } from '@/features/tenants/tenant-provider';
import { useCollectionsQuery } from '@/features/jimpitan/hooks';
import { formatCollectionMode } from '@/features/jimpitan/workflow';
import { AmountMetric, Metric } from '../components/metric';
import { LedgerDirectionBadge, TransactionStatusBadge } from '../components/status-badge';
import { ConfirmDialog } from '../components/confirm-dialog';
import { toUserMessage } from '../components/error-message';
import { ReportExportPanel } from '../components/report-export-panel';
import { useAccountsQuery, useApprovalsQuery, useCashFlowSummaryQuery, useCategoriesQuery, useFinanceMutations, useFinanceSummaryQuery, useLedgerQuery, useTransactionsQuery } from '../hooks';
import { formatCurrencyAmount } from '../workflow';

export function FinanceDashboardPage() {
  const { permissions } = useTenantContext();
  const summaryQuery = useFinanceSummaryQuery({ period: 'MONTHLY' });
  const cashFlowQuery = useCashFlowSummaryQuery({ period: 'MONTHLY' });
  const accountsQuery = useAccountsQuery({ page: 1, limit: 20, isActive: true, sortBy: 'name', sortDirection: 'asc' });
  const incomeCategoriesQuery = useCategoriesQuery({ page: 1, limit: 100, type: 'INCOME', isActive: true, sortBy: 'name', sortDirection: 'asc' });
  const pendingTransactionsQuery = useTransactionsQuery({ page: 1, limit: 1, status: 'DRAFT' });
  const pendingApprovalsQuery = useApprovalsQuery({ page: 1, limit: 1, status: 'PENDING' }, true);
  const ledgerQuery = useLedgerQuery({ page: 1, limit: 6, sortDirection: 'desc' });
  const collectionsQuery = useCollectionsQuery({ page: 1, limit: 8, status: 'VALIDATED', sortBy: 'collectionDate', sortDirection: 'desc' });
  const mutations = useFinanceMutations();
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [postedTransactionId, setPostedTransactionId] = useState<string | null>(null);
  const [confirmPostOpen, setConfirmPostOpen] = useState(false);
  const canPost = permissions.has('transactions.post');
  const cashBalanceRows = useMemo(() => summaryQuery.data?.cashBalances ?? [], [summaryQuery.data?.cashBalances]);

  async function postSelectedCollection() {
    if (!selectedCollectionId) {
      toast.error('Pilih jimpitan tervalidasi terlebih dahulu.');
      return;
    }
    try {
      const result = await mutations.postCollection.mutateAsync({
        collectionId: selectedCollectionId,
        cashAccountId: selectedAccountId || undefined,
        categoryId: selectedCategoryId || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      setPostedTransactionId(result.transaction.id);
      setConfirmPostOpen(false);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Keuangan"
        title="Keuangan"
        description="Kas, transaksi, persetujuan, dan operasi buku besar yang bersifat append-only."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/finance/transactions">Transaksi</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/finance/ledger">Buku besar</Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 md:grid-cols-5">
        {summaryQuery.isPending && permissions.has('reports.private.read') ? <Skeleton className="h-24 md:col-span-5" /> : null}
        <AmountMetric label="Saldo kas" amount={cashFlowQuery.data?.closingBalance ?? '0'} detail={permissions.has('reports.private.read') ? 'Arus kas dari buku besar' : 'Perlu akses laporan privat'} />
        <AmountMetric label="Total pemasukan" amount={cashFlowQuery.data?.income ?? '0'} detail="Periode laporan saat ini" />
        <AmountMetric label="Total pengeluaran" amount={cashFlowQuery.data?.expense ?? '0'} detail="Periode laporan saat ini" />
        <Metric label="Menunggu validasi" value={pendingTransactionsQuery.data?.total ?? '-'} />
        <Metric label="Menunggu persetujuan" value={pendingApprovalsQuery.data?.total ?? '-'} />
      </section>

      <ReportExportPanel includeLedger includeTransactions includePublicSafe />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Entri buku besar terbaru</h2>
              <p className="text-sm text-muted-foreground">Riwayat append-only, hanya-baca.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/finance/ledger">Buka buku besar</Link>
            </Button>
          </div>
          {ledgerQuery.isPending ? <Skeleton className="h-48 w-full" /> : null}
          {ledgerQuery.data?.items.length === 0 ? <EmptyState title="Belum ada entri buku besar" description="Transaksi yang diposting akan muncul di sini." /> : null}
          <div className="divide-y">
            {ledgerQuery.data?.items.map((entry) => (
              <div key={entry.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[6rem_minmax(0,1fr)_9rem_9rem] sm:items-center">
                <LedgerDirectionBadge direction={entry.entryType} />
                <Link href={`/dashboard/finance/transactions/${entry.transactionId}`} className="font-medium hover:underline">
                  Transaksi #{entry.ledgerSequence}
                </Link>
                <span>{formatCurrencyAmount(entry.amount)}</span>
                <span className="text-muted-foreground">{new Date(entry.ledgerDate).toLocaleDateString('id-ID')}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold">Akun kas</h2>
            <div className="mt-3 space-y-2">
              {accountsQuery.data?.items.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span>{account.name}</span>
                  <span className="font-medium">{formatCurrencyAmount(account.currentBalance)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold">Posting jimpitan tervalidasi</h2>
            <p className="mt-1 text-sm text-muted-foreground">Backend mencegah posting jimpitan ganda berdasarkan id jimpitan sumber.</p>
            <div className="mt-4 space-y-3">
              <select value={selectedCollectionId} onChange={(event) => setSelectedCollectionId(event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Pilih jimpitan tervalidasi</option>
                {collectionsQuery.data?.items.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {formatCollectionMode(collection.collectionMode)} - {collection.route.areaName ?? 'Semua area'} - {new Date(collection.collectionDate).toLocaleDateString('id-ID')} - {formatCurrencyAmount(collection.totalAmount)}
                  </option>
                ))}
              </select>
              <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Akun kas bawaan</option>
                {accountsQuery.data?.items.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <select value={selectedCategoryId} onChange={(event) => setSelectedCategoryId(event.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                <option value="">Kategori jimpitan bawaan</option>
                {incomeCategoriesQuery.data?.items.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Button type="button" className="w-full" disabled={!canPost || mutations.postCollection.isPending || Boolean(postedTransactionId)} onClick={() => setConfirmPostOpen(true)}>
                Posting jimpitan
              </Button>
              {postedTransactionId ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/dashboard/finance/transactions/${postedTransactionId}`}>Buka transaksi terposting</Link>
                </Button>
              ) : null}
              {!canPost ? <p className="text-sm text-muted-foreground">Posting memerlukan izin posting transaksi.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold">Antrean validasi</h2>
            <div className="mt-3 space-y-2">
              {pendingTransactionsQuery.data?.items.map((transaction) => (
                <Link key={transaction.id} href={`/dashboard/finance/transactions/${transaction.id}`} className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-muted">
                  <span>{transaction.description}</span>
                  <TransactionStatusBadge status={transaction.status} />
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-base font-semibold">Saldo akun dari buku besar</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {cashBalanceRows.map((account) => (
            <div key={account.cashAccountId} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{account.name}</p>
              <p className="mt-1">{formatCurrencyAmount(account.balance)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Urutan #{account.ledgerSequence}</p>
            </div>
          ))}
        </div>
      </section>
      <ConfirmDialog
        open={confirmPostOpen}
        title="Posting jimpitan ke keuangan"
        description="Posting membuat transaksi keuangan dan entri buku besar yang bersifat append-only. Posting jimpitan sumber ganda dicegah oleh backend."
        confirmLabel="Posting jimpitan"
        onOpenChange={setConfirmPostOpen}
        onConfirm={() => void postSelectedCollection()}
      />
    </main>
  );
}

function PageHeader({ eyebrow = 'Keuangan', title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0">{actions}</div> : null}
    </div>
  );
}
