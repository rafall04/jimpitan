/**
 * Purpose: BULK_TOTAL Jimpitan collection input panel.
 * Caller: Mobile and session detail flows when collectionMode is BULK_TOTAL.
 * Deps: React Hook Form, Zod resolver, UI inputs, schemas, and Jimpitan collection contracts.
 * MainFuncs: Captures a positive whole-rupiah session total and optional note without per-house checklist input.
 * SideEffects: Invokes caller-provided save handler.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bulkTotalSchema, toBulkTotalPayload, type BulkTotalValues } from '../schemas';
import type { CollectionSessionRecord, SetBulkCollectionTotalPayload } from '../types';

export function BulkTotalPanel({
  collection,
  isPending,
  onSubmit,
}: {
  collection: CollectionSessionRecord;
  isPending: boolean;
  onSubmit: (payload: SetBulkCollectionTotalPayload) => Promise<void> | void;
}) {
  const form = useForm<BulkTotalValues>({
    resolver: zodResolver(bulkTotalSchema),
    defaultValues: {
      totalAmount: collection.totalAmount === '0' ? '' : collection.totalAmount,
      note: collection.note ?? '',
    },
  });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit((values) => onSubmit(toBulkTotalPayload(values)))} noValidate>
      <div className="space-y-2">
        <Label htmlFor="bulk-total-amount">Total collected</Label>
        <Input id="bulk-total-amount" inputMode="numeric" placeholder="75000" {...form.register('totalAmount')} aria-invalid={Boolean(form.formState.errors.totalAmount)} />
        {form.formState.errors.totalAmount ? <p className="text-sm text-destructive">{form.formState.errors.totalAmount.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="bulk-total-note">Note</Label>
        <textarea
          id="bulk-total-note"
          {...form.register('note')}
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {form.formState.errors.note ? <p className="text-sm text-destructive">{form.formState.errors.note.message}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Saving' : 'Save total'}
      </Button>
    </form>
  );
}
