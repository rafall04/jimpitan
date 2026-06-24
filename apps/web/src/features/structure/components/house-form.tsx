/**
 * Purpose: House create/update form with tenant-scoped area selection and occupancy status.
 * Caller: Houses page sheet workflow.
 * Deps: React Hook Form, Zod resolver, house schema, and shadcn-compatible form primitives.
 * MainFuncs: Validates area assignment, house number, address note, and manual occupancy status.
 * SideEffects: Invokes caller-provided submit handler.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { houseFormSchema, type HouseFormValues } from '../schemas';
import type { AreaRecord, HouseRecord } from '../types';

export function HouseForm({
  initialHouse,
  areas,
  isPending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialHouse?: HouseRecord | null;
  areas: AreaRecord[];
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: HouseFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const firstAreaId = areas[0]?.id ?? '';
  const form = useForm<HouseFormValues>({
    resolver: zodResolver(houseFormSchema),
    defaultValues: {
      areaId: initialHouse?.areaId ?? firstAreaId,
      houseNumber: initialHouse?.houseNumber ?? '',
      addressNote: initialHouse?.addressNote ?? '',
      status: initialHouse?.status === 'OCCUPIED' ? 'OCCUPIED' : 'EMPTY',
    },
  });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="house-area">Area</Label>
        <select
          id="house-area"
          {...form.register('areaId')}
          aria-invalid={Boolean(form.formState.errors.areaId)}
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.code} - {area.name}
            </option>
          ))}
        </select>
        {form.formState.errors.areaId ? <p className="text-sm text-destructive">{form.formState.errors.areaId.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="house-number">Nomor rumah</Label>
        <Input id="house-number" {...form.register('houseNumber')} aria-invalid={Boolean(form.formState.errors.houseNumber)} />
        {form.formState.errors.houseNumber ? <p className="text-sm text-destructive">{form.formState.errors.houseNumber.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="house-status">Status hunian</Label>
        <select
          id="house-status"
          {...form.register('status')}
          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <option value="EMPTY">Kosong</option>
          <option value="OCCUPIED">Terisi</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="house-note">Catatan alamat</Label>
        <textarea
          id="house-note"
          {...form.register('addressNote')}
          aria-invalid={Boolean(form.formState.errors.addressNote)}
          className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {form.formState.errors.addressNote ? <p className="text-sm text-destructive">{form.formState.errors.addressNote.message}</p> : null}
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Batal
        </Button>
        <Button type="submit" disabled={isPending || areas.length === 0}>
          {isPending ? 'Menyimpan…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
