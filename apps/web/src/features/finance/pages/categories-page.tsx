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
      <Header title="Transaction categories" description="Manage income and expense categories. Archived categories cannot be used for new drafts." action={canCreate ? <Button onClick={() => setSheetOpen(true)}><Plus className="h-4 w-4" aria-hidden="true" />New category</Button> : null} />
      <section className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <SearchField label="Search categories" placeholder="Search category" value={search} onChange={(value) => { setSearch(value); setPage(1); }} />
        <SelectField id="category-type-filter" label="Type" value={type} onChange={(value) => { setType(value); setPage(1); }}>
          <option value="">All</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </SelectField>
      </section>
      {query.isPending ? <ListSkeleton label="Loading categories" /> : null}
      {query.data?.items.length === 0 ? <EmptyState title="No categories" description="Create income and expense categories before drafting transactions." /> : null}
      <div className="rounded-lg border bg-card">
        <div className="divide-y">
          {query.data?.items.map((category) => (
            <div key={category.id} className="grid gap-3 p-4 md:grid-cols-[8rem_minmax(0,1fr)_8rem_14rem] md:items-center">
              <TransactionTypeBadge type={category.type} />
              <div>
                <p className="font-medium">{category.name}</p>
                <p className="text-sm text-muted-foreground">{category.key}{category.isSystem ? ' - system' : ''}</p>
              </div>
              <span className="text-sm text-muted-foreground">{category.isActive ? 'Active' : 'Inactive'}</span>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {canUpdate && !category.isSystem ? <Button type="button" size="sm" variant="outline" onClick={() => void toggle(category)}>{category.isActive ? 'Deactivate' : 'Reactivate'}</Button> : null}
                {canArchive && !category.isSystem ? <Button type="button" size="sm" variant="destructive" onClick={() => setArchiveTarget(category)}>Archive</Button> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {query.data ? <PaginationControls page={query.data.page} totalPages={query.data.totalPages} total={query.data.total} onPageChange={setPage} /> : null}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:w-[32rem]">
          <SheetHeader>
            <SheetTitle>New category</SheetTitle>
            <SheetDescription>Create a tenant-scoped income or expense category.</SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <CategoryForm isPending={mutations.createCategory.isPending} onSubmit={create} onCancel={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog open={Boolean(archiveTarget)} title="Archive category" description="Archived categories cannot be used in new transactions. Existing posted ledger history remains readable." destructive reasonRequired onOpenChange={(open) => !open && setArchiveTarget(null)} onConfirm={(reason) => void archive(reason)} />
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
