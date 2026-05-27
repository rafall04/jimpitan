/**
 * Purpose: Collection session creation form for operational dashboard users.
 * Caller: Jimpitan sessions page and dashboard create sheet.
 * Deps: React Hook Form, Zod resolver, structure area records, membership rows, and shadcn-compatible controls.
 * MainFuncs: Validates officer, date, collection mode, route, optional bulk total, and note fields before creating a backend session.
 * SideEffects: Invokes caller-provided submit handler.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AreaRecord } from '@/features/structure/types';
import { createCollectionSchema, type CreateCollectionValues } from '../schemas';
import { selectableCollectionModes, type TenantMembershipRow } from '../types';

export function SessionForm({
  defaultOfficerMembershipId,
  officers,
  areas,
  isPending,
  onSubmit,
  onCancel,
}: {
  defaultOfficerMembershipId: string;
  officers: TenantMembershipRow[];
  areas: AreaRecord[];
  isPending: boolean;
  onSubmit: (values: CreateCollectionValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const form = useForm<CreateCollectionValues>({
    resolver: zodResolver(createCollectionSchema),
    defaultValues: {
      officerMembershipId: officers[0]?.id ?? defaultOfficerMembershipId,
      collectionDate: new Date().toISOString().slice(0, 10),
      collectionMode: 'PER_HOUSE',
      totalAmount: '',
      areaId: '',
      note: '',
    },
  });
  const collectionMode = form.watch('collectionMode') ?? 'PER_HOUSE';

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="collection-officer">Officer</Label>
        <select id="collection-officer" {...form.register('officerMembershipId')} className="flex h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {officers.map((officer) => (
            <option key={officer.id} value={officer.id}>
              {officer.user.fullName}
            </option>
          ))}
        </select>
        {form.formState.errors.officerMembershipId ? <p className="text-sm text-destructive">{form.formState.errors.officerMembershipId.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="collection-date">Collection date</Label>
        <Input id="collection-date" type="date" {...form.register('collectionDate')} aria-invalid={Boolean(form.formState.errors.collectionDate)} />
        {form.formState.errors.collectionDate ? <p className="text-sm text-destructive">{form.formState.errors.collectionDate.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="collection-mode">Collection mode</Label>
        <select id="collection-mode" {...form.register('collectionMode')} className="flex h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {selectableCollectionModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode === 'PER_HOUSE' ? 'Per house' : 'Bulk total'}
            </option>
          ))}
        </select>
        {form.formState.errors.collectionMode ? <p className="text-sm text-destructive">{form.formState.errors.collectionMode.message}</p> : null}
      </div>
      {collectionMode === 'BULK_TOTAL' ? (
        <div className="space-y-2">
          <Label htmlFor="collection-total-amount">Initial total amount</Label>
          <Input id="collection-total-amount" inputMode="numeric" {...form.register('totalAmount')} aria-invalid={Boolean(form.formState.errors.totalAmount)} />
          {form.formState.errors.totalAmount ? <p className="text-sm text-destructive">{form.formState.errors.totalAmount.message}</p> : null}
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="collection-area">Route area</Label>
        <select id="collection-area" {...form.register('areaId')} className="flex h-11 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <option value="">All areas</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.code} - {area.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="collection-note">Note</Label>
        <textarea id="collection-note" {...form.register('note')} className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
        {form.formState.errors.note ? <p className="text-sm text-destructive">{form.formState.errors.note.message}</p> : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || officers.length === 0}>
          {isPending ? 'Creating' : 'Create session'}
        </Button>
      </div>
    </form>
  );
}
