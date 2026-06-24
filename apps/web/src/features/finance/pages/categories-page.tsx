/**
 * Purpose: Tenant-aware transaction category management page.
 * Caller: App Router /dashboard/finance/categories route.
 * Deps: Finance hooks, category form, confirmation dialog, RBAC context, and list shell components.
 * MainFuncs: Lists income/expense categories, creates categories, toggles active state, and archives with explicit reasons.
 * SideEffects: Performs tenant-scoped category mutations through TanStack Query.
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
import { CategoryForm } from '../components/finance-form';
import { TransactionTypeBadge } from '../components/status-badge';
import { ConfirmDialog } from '../components/confirm-dialog';
import { toUserMessage } from '../components/error-message';
import { toCategoryPayload, type CategoryValues } from '../schemas';
import { useCategoriesQuery, useFinanceMutations } from '../hooks';
import type { TransactionCategoryRecord } from '../types';

export function CategoriesPage() {
  const { permissions } = useTenantContext();
  const canCreate = permissions.has('transactions.create');
  const canUpdate = permissions.has('transactions.update');
  const canArchive = permissions.has('transactions.delete');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<TransactionCategoryRecord | null>(null);
  const query = useCategoriesQuery({ page, limit: 20, search, type: type as never || undefined, sortBy: 'name', sortDirection: 'asc' });
  const mutations = useFinanceMutations();

  async function create(values: CategoryValues) {
    try {
      await mutations.createCategory.mutateAsync(toCategoryPayload(values));
      setSheetOpen(false);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function toggle(category: TransactionCategoryRecord) {
    try {
      await mutations.updateCategory.mutateAsync({ categoryId: category.id, payload: { isActive: !category.isActive } });
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  async function archive(reason?: string) {
    if (!archiveTarget || !reason) return;
    try {
      await mutations.archiveCategory.mutateAsync({ categoryId: archiveTarget.id, reason });
      setArchiveTarget(null);
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  return (
    <main id="main-content" className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Header title="Kategori transaksi" description="Kelola kategori pemasukan dan pengeluaran. Kategori yang diarsipkan tidak dapat dipakai untuk draf baru." action={canCreate ? <Button onClick={() => setSheetOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" />Tambah kategori</Button> : null} />
      <section className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <SearchField label="Cari kategori" placeholder="Cari kategori" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
        <SelectField id="category-type-filter" label="Jenis" value={type} onChange={(value) => { setType(value); setPage(1); }}>
          <option value="">Semua</option>
          <option value="INCOME">Pemasukan</option>
          <option value="EXPENSE">Pengeluaran</option>
        </SelectField>
      </section>
      {query.isPending ? <ListSkeleton label="Memuat kategori" /> : null}
      {query.data?.items.length === 0 ? <EmptyState title="Belum ada kategori" description="Buat kategori pemasukan dan pengeluaran sebelum membuat draf transaksi." /> : null}
      <div className="rounded-xl border bg-card">
        <div className="divide-y">
          {query.data?.items.map((category) => (
            <div key={category.id} className="grid gap-3 p-4 md:grid-cols-[8rem_minmax(0,1fr)_8rem_14rem] md:items-center">
              <TransactionTypeBadge type={category.type} />
              <div>
                <p className="font-medium">{category.name}</p>
                <p className="text-sm text-muted-foreground">{category.key}{category.isSystem ? ' - sistem' : ''}</p>
              </div>
              <span className="text-sm text-muted-foreground">{category.isActive ? 'Aktif' : 'Nonaktif'}</span>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {canUpdate && !category.isSystem ? <Button type="button" size="sm" variant="outline" onClick={() => void toggle(category)}>{category.isActive ? 'Nonaktifkan' : 'Aktifkan kembali'}</Button> : null}
                {canArchive && !category.isSystem ? <Button type="button" size="sm" variant="destructive" onClick={() => setArchiveTarget(category)}>Arsipkan</Button> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {query.data ? <PaginationControls page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPageChange={setPage} /> : null}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:w-[32rem]">
          <SheetHeader>
            <SheetTitle>Tambah kategori</SheetTitle>
            <SheetDescription>Buat kategori pemasukan atau pengeluaran khusus RT.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CategoryForm isPending={mutations.createCategory.isPending} onSubmit={create} onCancel={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={Boolean(archiveTarget)} title="Arsipkan kategori" description="Kategori yang diarsipkan tidak dapat dipakai pada transaksi baru. Riwayat buku besar yang sudah diposting tetap dapat dibaca." destructive reasonRequired onOpenChange={(open) => !open && setArchiveTarget(null)} onConfirm={(reason) => void archive(reason)} />
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
