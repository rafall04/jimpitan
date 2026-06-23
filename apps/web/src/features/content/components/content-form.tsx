/**
 * Purpose: Create/edit form for a content post (announcement, activity, article, gallery).
 * Caller: Content create + edit pages.
 * Deps: React Hook Form, Zod resolver, content schema + labels, shadcn-compatible primitives.
 * MainFuncs: Validates title/body/visibility plus conditional activity date/location, and submits with a publish intent.
 * SideEffects: Invokes the caller-provided submit handler.
 */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import { CONTENT_TYPE_OPTIONS, contentFormSchema, type ContentFormValues } from '../schemas';
import { toDateTimeLocal } from '../format';
import type { ContentPostRecord } from '../types';

const FIELD = 'flex w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function ContentForm({
  mode,
  initial,
  isPending,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  initial?: ContentPostRecord | null;
  isPending: boolean;
  onSubmit: (values: ContentFormValues, options: { publish: boolean }) => Promise<void> | void;
  onCancel: () => void;
}) {
  const form = useForm<ContentFormValues>({
    resolver: zodResolver(contentFormSchema),
    defaultValues: {
      type: initial?.type ?? 'ANNOUNCEMENT',
      title: initial?.title ?? '',
      body: initial?.body ?? '',
      excerpt: initial?.excerpt ?? '',
      visibility: initial?.visibility ?? 'PUBLIC',
      eventStartAt: toDateTimeLocal(initial?.eventStartAt),
      eventEndAt: toDateTimeLocal(initial?.eventEndAt),
      location: initial?.location ?? '',
    },
  });

  const type = form.watch('type');
  const errors = form.formState.errors;
  const submitWith = (publish: boolean) => form.handleSubmit((values) => onSubmit(values, { publish }))();

  return (
    <form className="space-y-5" onSubmit={(event) => event.preventDefault()} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="content-type">Jenis konten</Label>
          <select id="content-type" className={cn(FIELD, 'h-10')} {...form.register('type')} disabled={mode === 'edit'}>
            {CONTENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.helper}
              </option>
            ))}
          </select>
          {mode === 'edit' ? <p className="text-xs text-muted-foreground">Jenis tidak dapat diubah setelah dibuat.</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="content-visibility">Visibilitas</Label>
          <select id="content-visibility" className={cn(FIELD, 'h-10')} {...form.register('visibility')}>
            <option value="PUBLIC">Publik (tampil di situs)</option>
            <option value="MEMBERS">Khusus anggota</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-title">Judul</Label>
        <Input id="content-title" {...form.register('title')} aria-invalid={Boolean(errors.title)} />
        {errors.title ? <p className="text-sm text-destructive">{errors.title.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-excerpt">Ringkasan singkat (opsional)</Label>
        <textarea id="content-excerpt" rows={2} className={cn(FIELD, 'min-h-[60px]')} {...form.register('excerpt')} aria-invalid={Boolean(errors.excerpt)} />
        {errors.excerpt ? <p className="text-sm text-destructive">{errors.excerpt.message}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="content-body">Isi konten</Label>
        <textarea id="content-body" rows={10} className={cn(FIELD, 'min-h-[180px]')} {...form.register('body')} aria-invalid={Boolean(errors.body)} />
        {errors.body ? <p className="text-sm text-destructive">{errors.body.message}</p> : <p className="text-xs text-muted-foreground">Baris baru dipertahankan saat ditampilkan.</p>}
      </div>

      {type === 'ACTIVITY' ? (
        <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="content-event-start">Mulai</Label>
            <Input id="content-event-start" type="datetime-local" {...form.register('eventStartAt')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content-event-end">Selesai</Label>
            <Input id="content-event-end" type="datetime-local" {...form.register('eventEndAt')} aria-invalid={Boolean(errors.eventEndAt)} />
            {errors.eventEndAt ? <p className="text-sm text-destructive">{errors.eventEndAt.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="content-location">Lokasi</Label>
            <Input id="content-location" placeholder="mis. Balai RT" {...form.register('location')} />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Batal
        </Button>
        <Button type="button" variant={mode === 'create' ? 'outline' : 'default'} onClick={() => void submitWith(false)} disabled={isPending}>
          {isPending ? 'Menyimpan…' : mode === 'create' ? 'Simpan draf' : 'Simpan perubahan'}
        </Button>
        {mode === 'create' ? (
          <Button type="button" onClick={() => void submitWith(true)} disabled={isPending}>
            {isPending ? 'Menyimpan…' : 'Simpan & terbitkan'}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
