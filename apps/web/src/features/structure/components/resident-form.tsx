/**
 * Purpose: Resident create/update form with house assignment and safe editable resident fields.
 * Caller: Residents page sheet workflow.
 * Deps: React Hook Form, Zod resolver, resident schema, and shadcn-compatible form primitives.
 * MainFuncs: Validates resident identity, contact, default collection amount, notes, and assignable house selection.
 * SideEffects: Invokes caller-provided submit handler.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { residentFormSchema, type ResidentFormValues } from '../schemas';
import type { HouseRecord, ResidentRecord } from '../types';

export function ResidentForm({
  initialResident,
  houses,
  isPending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialResident?: ResidentRecord | null;
  houses: HouseRecord[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: ResidentFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const firstHouseId = houses[0]?.id ?? '';
  const form = useForm<ResidentFormValues>({
    resolver: zodResolver(residentFormSchema),
    defaultValues: {
      houseId: initialResident?.houseId ?? firstHouseId,
      fullName: initialResident?.fullName ?? '',
      phone: initialResident?.phone ?? '',
      defaultJimpitanAmount: initialResident?.defaultJimpitanAmount ?? '',
      notes: initialResident?.notes ?? '',
    },
  });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="resident-house">House assignment</Label>
        <select
          id="resident-house"
          {...form.register('houseId')}
          aria-invalid={Boolean(form.formState.errors.houseId)}
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {houses.map((house) => (
            <option key={house.id} value={house.id}>
              {house.area.code} - {house.houseNumber}
            </option>
          ))}
        </select>
        {form.formState.errors.houseId ? <p className="text-sm text-destructive">{form.formState.errors.houseId.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="resident-name">Full name</Label>
        <Input id="resident-name" {...form.register('fullName')} aria-invalid={Boolean(form.formState.errors.fullName)} />
        {form.formState.errors.fullName ? <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="resident-phone">Phone</Label>
        <Input id="resident-phone" inputMode="tel" {...form.register('phone')} aria-invalid={Boolean(form.formState.errors.phone)} />
        {form.formState.errors.phone ? <p className="text-sm text-destructive">{form.formState.errors.phone.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="resident-amount">Default jimpitan amount</Label>
        <Input id="resident-amount" inputMode="decimal" {...form.register('defaultJimpitanAmount')} aria-invalid={Boolean(form.formState.errors.defaultJimpitanAmount)} />
        {form.formState.errors.defaultJimpitanAmount ? <p className="text-sm text-destructive">{form.formState.errors.defaultJimpitanAmount.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="resident-notes">Notes</Label>
        <textarea
          id="resident-notes"
          {...form.register('notes')}
          aria-invalid={Boolean(form.formState.errors.notes)}
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {form.formState.errors.notes ? <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p> : null}
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || houses.length === 0}>
          {isPending ? 'Saving' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
