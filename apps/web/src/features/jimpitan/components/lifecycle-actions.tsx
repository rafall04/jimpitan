/**
 * Purpose: RBAC-aware lifecycle action controls for Jimpitan collection sessions.
 * Caller: Session detail page and operational dashboard cards.
 * Deps: Button, dialog primitives, Jimpitan hooks, workflow helpers, and status types.
 * MainFuncs: Starts, generates checklists, submits, validates, rejects, and cancels sessions through confirmed actions.
 * SideEffects: Calls mutation handlers provided by parent pages.
 */
'use client';

import { useState } from 'react';
import { Check, ClipboardList, Play, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCollectionActions, type CollectionAction } from '../workflow';
import type { CollectionSessionRecord } from '../types';

export function LifecycleActions({
  collection,
  permissions,
  membershipId,
  isPending,
  onStart,
  onGenerate,
  onSubmit,
  onValidate,
  onReject,
  onCancel,
}: {
  collection: CollectionSessionRecord;
  permissions: ReadonlySet<string>;
  membershipId?: string;
  isPending: boolean;
  onStart: () => void;
  onGenerate: () => void;
  onSubmit: () => void;
  onValidate: (note?: string) => void;
  onReject: (reason: string) => void;
  onCancel: (reason: string) => void;
}) {
  const [dialog, setDialog] = useState<CollectionAction | null>(null);
  const actions = getCollectionActions(collection, permissions, membershipId);

  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes('start') ? (
        <Button type="button" size="sm" onClick={onStart} disabled={isPending}>
          <Play className="h-4 w-4" aria-hidden="true" />
          Mulai
        </Button>
      ) : null}
      {actions.includes('generate-checklist') ? (
        <Button type="button" size="sm" variant="outline" onClick={onGenerate} disabled={isPending}>
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Daftar rumah
        </Button>
      ) : null}
      {actions.includes('submit') ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog('submit')} disabled={isPending}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Ajukan
        </Button>
      ) : null}
      {actions.includes('validate') ? (
        <Button type="button" size="sm" onClick={() => setDialog('validate')} disabled={isPending}>
          <Check className="h-4 w-4" aria-hidden="true" />
          Validasi
        </Button>
      ) : null}
      {actions.includes('reject') ? (
        <Button type="button" size="sm" variant="destructive" onClick={() => setDialog('reject')} disabled={isPending}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Tolak
        </Button>
      ) : null}
      {actions.includes('cancel') ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog('cancel')} disabled={isPending}>
          Batalkan
        </Button>
      ) : null}
      <LifecycleDialog
        action={dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        onSubmit={() => {
          onSubmit();
          setDialog(null);
        }}
        onValidate={(note) => {
          onValidate(note);
          setDialog(null);
        }}
        onReject={(reason) => {
          onReject(reason);
          setDialog(null);
        }}
        onCancelCollection={(reason) => {
          onCancel(reason);
          setDialog(null);
        }}
      />
    </div>
  );
}

function LifecycleDialog({
  action,
  onOpenChange,
  onSubmit,
  onValidate,
  onReject,
  onCancelCollection,
}: {
  action: CollectionAction | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  onValidate: (note?: string) => void;
  onReject: (reason: string) => void;
  onCancelCollection: (reason: string) => void;
}) {
  const [text, setText] = useState('');
  const requiresReason = action === 'reject' || action === 'cancel';
  const title = action === 'submit' ? 'Ajukan sesi' : action === 'validate' ? 'Validasi sesi' : action === 'reject' ? 'Tolak sesi' : 'Batalkan sesi';

  return (
    <Dialog open={Boolean(action)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{dialogDescription(action)}</DialogDescription>
        </DialogHeader>
        {action && action !== 'submit' ? (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={requiresReason ? 'Alasan wajib diisi' : 'Catatan validasi (opsional)'}
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Kembali
          </Button>
          <Button
            type="button"
            variant={action === 'reject' ? 'destructive' : 'default'}
            disabled={requiresReason && text.trim().length < 2}
            onClick={() => {
              if (action === 'submit') onSubmit();
              if (action === 'validate') onValidate(text.trim() || undefined);
              if (action === 'reject') onReject(text.trim());
              if (action === 'cancel') onCancelCollection(text.trim());
            }}
          >
            Konfirmasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function dialogDescription(action: CollectionAction | null): string {
  if (action === 'submit') return 'Ajukan sesi ini untuk divalidasi bendahara. Petugas tidak dapat mengubahnya selama menunggu validasi.';
  if (action === 'validate') return 'Validasi sesi yang telah diajukan ini. Pencatatan ke kas tetap dilakukan terpisah di sistem.';
  if (action === 'reject') return 'Tolak sesi yang diajukan ini dan kembalikan disertai alasan.';
  if (action === 'cancel') return 'Batalkan sesi ini. Sesi yang sudah tervalidasi tidak dapat dibatalkan.';
  return '';
}
