/**
 * Purpose: Large-touch collection item input panel for one-handed mobile field usage.
 * Caller: Jimpitan mobile collection route.
 * Deps: Button/Input primitives, collection schemas, status badges, and checklist types.
 * MainFuncs: Selects quick statuses/amounts, validates item payloads, and submits save-and-next actions.
 * SideEffects: Invokes caller-provided save handler.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { collectionItemStatuses, collectionItemFormSchema, toCollectionItemPayload } from '../schemas';
import { formatItemStatus, ItemStatusBadge } from './status-badge';
import type { CollectionChecklistHouse, CollectionItemPayload, CollectionItemStatus } from '../types';

const quickAmounts = ['1000', '2000', '5000'];

export function MobileItemPanel({ house, isPending, onSave }: { house: CollectionChecklistHouse; isPending: boolean; onSave: (payload: CollectionItemPayload) => Promise<void> | void }) {
  const initialStatus = house.item?.status ?? 'PAID';
  const [status, setStatus] = useState<CollectionItemStatus>(initialStatus);
  const [amount, setAmount] = useState(house.item?.amount ?? house.primaryResident?.defaultJimpitanAmount ?? '1000');
  const [note, setNote] = useState(house.item?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const displayAmount = status === 'PAID' ? amount : '';
  const residentId = house.primaryResident?.id ?? '';

  useEffect(() => {
    setStatus(house.item?.status ?? 'PAID');
    setAmount(house.item?.amount ?? house.primaryResident?.defaultJimpitanAmount ?? '1000');
    setNote(house.item?.note ?? '');
    setError(null);
  }, [house.houseId, house.item?.amount, house.item?.note, house.item?.status, house.primaryResident?.defaultJimpitanAmount]);

  const payload = useMemo(
    () => ({
      houseId: house.houseId,
      residentId,
      amount: displayAmount,
      status,
      note,
    }),
    [displayAmount, house.houseId, note, residentId, status],
  );

  async function submit() {
    const parsed = collectionItemFormSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Periksa kembali isian setoran.');
      return;
    }
    setError(null);
    await onSave(toCollectionItemPayload(parsed.data));
  }

  return (
    <section className="space-y-5">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{house.area.code}</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-normal">{house.houseNumber}</h2>
            <p className="mt-2 text-base">{house.primaryResident?.fullName ?? 'Tidak ada warga aktif'}</p>
          </div>
          {house.item ? <ItemStatusBadge status={house.item.status} /> : <ItemStatusBadge status="NO_INPUT" />}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {collectionItemStatuses.map((option) => (
          <Button key={option} type="button" variant={status === option ? 'default' : 'outline'} className="min-h-14 whitespace-normal px-2 text-sm" onClick={() => setStatus(option)}>
            {formatItemStatus(option)}
          </Button>
        ))}
      </div>
      {status === 'PAID' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {quickAmounts.map((value) => (
              <Button key={value} type="button" variant={amount === value ? 'default' : 'outline'} className="min-h-14 text-base" onClick={() => setAmount(value)}>
                {Number(value).toLocaleString('id-ID')}
              </Button>
            ))}
          </div>
          <Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" aria-label="Nominal setoran" className="h-14 text-lg" />
        </div>
      ) : null}
      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Catatan (opsional)" className="min-h-20 w-full rounded-md border bg-background px-3 py-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="sticky bottom-0 -mx-4 border-t bg-background/95 p-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="button" className="min-h-14 w-full text-base" onClick={submit} disabled={isPending}>
          {isPending ? 'Menyimpan' : house.item ? 'Perbarui & lanjut' : 'Simpan & lanjut'}
        </Button>
      </div>
    </section>
  );
}
