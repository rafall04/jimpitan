/**
 * Purpose: Area create/update form for RT route and block records.
 * Caller: Areas page sheet workflow.
 * Deps: React Hook Form, Zod resolver, area schema, and shadcn-compatible form primitives.
 * MainFuncs: Validates area code, name, and sort order before submitting typed values.
 * SideEffects: Invokes caller-provided submit handler.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { areaFormSchema, type AreaFormValues } from '../schemas';
import type { AreaRecord } from '../types';

export function AreaForm({
  initialArea,
  isPending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialArea?: AreaRecord | null;
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: AreaFormValues) => Promise<void> | void;
  onCancel: () => void;
}) {
  const form = useForm<AreaFormValues>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: {
      code: initialArea?.code ?? '',
      name: initialArea?.name ?? '',
      sortOrder: initialArea ? String(initialArea.sortOrder) : '',
    },
  });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="area-code">Kode area</Label>
        <Input id="area-code" {...form.register('code')} aria-invalid={Boolean(form.formState.errors.code)} />
        {form.formState.errors.code ? <p className="text-sm text-destructive">{form.formState.errors.code.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="area-name">Nama area</Label>
        <Input id="area-name" {...form.register('name')} aria-invalid={Boolean(form.formState.errors.name)} />
        {form.formState.errors.name ? <p className="text-sm text-destructive">{form.formState.errors.name.message}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="area-sort">Urutan</Label>
        <Input id="area-sort" inputMode="numeric" {...form.register('sortOrder')} aria-invalid={Boolean(form.formState.errors.sortOrder)} />
        {form.formState.errors.sortOrder ? <p className="text-sm text-destructive">{form.formState.errors.sortOrder.message}</p> : null}
      </div>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Batal
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Menyimpan…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
