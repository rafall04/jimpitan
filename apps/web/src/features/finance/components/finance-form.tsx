/**
 * Purpose: React Hook Form forms for finance account, category, and transaction draft creation.
 * Caller: Finance account/category/transaction pages.
 * Deps: React Hook Form, Zod resolver, shadcn primitives, finance schemas, and contract types.
 * MainFuncs: Renders accessible validated forms without duplicating backend financial lifecycle rules.
 * SideEffects: Invokes caller-provided submit handlers.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { accountSchema, categorySchema, transactionSchema, type AccountValues, type CategoryValues, type TransactionValues } from '../schemas';
import type { CashAccountRecord, TransactionCategoryRecord } from '../types';

export function AccountForm({ isPending, onSubmit, onCancel }: { isPending: boolean; onSubmit: (values: AccountValues) => void; onCancel: () => void }) {
  const form = useForm<AccountValues>({ resolver: zodResolver(accountSchema), defaultValues: { key: '', name: '', currency: 'IDR' } });
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Field id="account-key" label="Key" error={form.formState.errors.key?.message}>
        <Input id="account-key" {...form.register('key')} placeholder="main_cash" />
      </Field>
      <Field id="account-name" label="Name" error={form.formState.errors.name?.message}>
        <Input id="account-name" {...form.register('name')} placeholder="Main Cash" />
      </Field>
      <Field id="account-currency" label="Currency" error={form.formState.errors.currency?.message}>
        <Input id="account-currency" {...form.register('currency')} placeholder="IDR" />
      </Field>
      <FormActions isPending={isPending} onCancel={onCancel} />
    </form>
  );
}

export function CategoryForm({ isPending, onSubmit, onCancel }: { isPending: boolean; onSubmit: (values: CategoryValues) => void; onCancel: () => void }) {
  const form = useForm<CategoryValues>({ resolver: zodResolver(categorySchema), defaultValues: { type: 'EXPENSE', key: '', name: '' } });
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Field id="category-type" label="Type" error={form.formState.errors.type?.message}>
        <select id="category-type" {...form.register('type')} className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <option value="EXPENSE">Expense</option>
          <option value="INCOME">Income</option>
        </select>
      </Field>
      <Field id="category-key" label="Key" error={form.formState.errors.key?.message}>
        <Input id="category-key" {...form.register('key')} placeholder="operational" />
      </Field>
      <Field id="category-name" label="Name" error={form.formState.errors.name?.message}>
        <Input id="category-name" {...form.register('name')} placeholder="Operational" />
      </Field>
      <FormActions isPending={isPending} onCancel={onCancel} />
    </form>
  );
}

export function TransactionForm({
  type,
  accounts,
  categories,
  isPending,
  onSubmit,
  onCancel,
}: {
  type: 'income' | 'expense';
  accounts: CashAccountRecord[];
  categories: TransactionCategoryRecord[];
  isPending: boolean;
  onSubmit: (values: TransactionValues) => void;
  onCancel: () => void;
}) {
  const form = useForm<TransactionValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: { cashAccountId: accounts[0]?.id ?? '', categoryId: categories[0]?.id ?? '', amount: '', description: '', transactionDate: new Date().toISOString().slice(0, 10), referenceNumber: '' },
  });
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Field id={`${type}-account`} label="Cash account" error={form.formState.errors.cashAccountId?.message}>
        <select id={`${type}-account`} {...form.register('cashAccountId')} className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${type}-category`} label="Category" error={form.formState.errors.categoryId?.message}>
        <select id={`${type}-category`} {...form.register('categoryId')} className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id={`${type}-amount`} label="Amount" error={form.formState.errors.amount?.message}>
        <Input id={`${type}-amount`} inputMode="decimal" {...form.register('amount')} />
      </Field>
      <Field id={`${type}-date`} label="Transaction date" error={form.formState.errors.transactionDate?.message}>
        <Input id={`${type}-date`} type="date" {...form.register('transactionDate')} />
      </Field>
      <Field id={`${type}-description`} label="Description" error={form.formState.errors.description?.message}>
        <textarea id={`${type}-description`} {...form.register('description')} className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
      </Field>
      <Field id={`${type}-reference`} label="Reference" error={form.formState.errors.referenceNumber?.message}>
        <Input id={`${type}-reference`} {...form.register('referenceNumber')} />
      </Field>
      <FormActions isPending={isPending} onCancel={onCancel} />
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function FormActions({ isPending, onCancel }: { isPending: boolean; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving' : 'Save draft'}
      </Button>
    </div>
  );
}
