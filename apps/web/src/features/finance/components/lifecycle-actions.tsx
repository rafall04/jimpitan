/**
 * Purpose: RBAC-aware finance transaction and approval lifecycle controls.
 * Caller: Transaction list/detail pages and approval queue/detail pages.
 * Deps: Confirmation dialog, workflow helpers, button primitive, and finance contract types.
 * MainFuncs: Shows explicit validate/reject/void/post and approve/reject actions with confirmation.
 * SideEffects: Calls parent-provided mutation handlers.
 */
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from './confirm-dialog';
import { getApprovalActions, getTransactionActions, type ApprovalAction, type TransactionAction } from '../workflow';
import type { ApprovalRecord, FinanceTransactionRecord } from '../types';

export function TransactionLifecycleActions({
  transaction,
  permissions,
  isPending,
  onValidate,
  onReject,
  onVoid,
  onPost,
}: {
  transaction: FinanceTransactionRecord;
  permissions: ReadonlySet<string>;
  isPending: boolean;
  onValidate: (note?: string) => void;
  onReject: (reason: string) => void;
  onVoid: (reason: string) => void;
  onPost: () => void;
}) {
  const [dialog, setDialog] = useState<TransactionAction | null>(null);
  const actions = getTransactionActions(transaction, permissions);
  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes('validate') ? (
        <Button type="button" size="sm" onClick={() => setDialog('validate')} disabled={isPending}>
          Validasi
        </Button>
      ) : null}
      {actions.includes('post') ? (
        <Button type="button" size="sm" onClick={() => setDialog('post')} disabled={isPending}>
          Posting
        </Button>
      ) : null}
      {actions.includes('reject') ? (
        <Button type="button" size="sm" variant="destructive" onClick={() => setDialog('reject')} disabled={isPending}>
          Tolak
        </Button>
      ) : null}
      {actions.includes('void') ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog('void')} disabled={isPending}>
          Batalkan draf
        </Button>
      ) : null}
      <ConfirmDialog
        open={dialog === 'validate'}
        title="Validasi transaksi"
        description="Validasi draf ini untuk posting atau evaluasi persetujuan. Aturan backend tetap menjadi acuan utama."
        inputLabel="Catatan validasi"
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(note) => {
          onValidate(note);
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'post'}
        title="Posting transaksi"
        description="Posting menulis entri buku besar yang bersifat append-only. Transaksi yang telah diposting tidak dapat diubah dan koreksi memerlukan penyesuaian."
        confirmLabel="Posting transaksi"
        inputLabel="Catatan posting (opsional)"
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={() => {
          onPost();
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        title="Tolak transaksi"
        description="Transaksi yang ditolak tidak dapat diposting. Berikan alasan yang jelas untuk jejak audit."
        confirmLabel="Tolak"
        destructive
        reasonRequired
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(reason) => {
          onReject(reason ?? '');
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'void'}
        title="Batalkan draf"
        description="Hanya transaksi berstatus draf yang dapat dibatalkan. Berikan alasan untuk jejak audit."
        confirmLabel="Batalkan draf"
        destructive
        reasonRequired
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(reason) => {
          onVoid(reason ?? '');
          setDialog(null);
        }}
      />
    </div>
  );
}

export function ApprovalLifecycleActions({
  approval,
  permissions,
  isPending,
  onApprove,
  onReject,
}: {
  approval: ApprovalRecord;
  permissions: ReadonlySet<string>;
  isPending: boolean;
  onApprove: (note?: string) => void;
  onReject: (reason: string) => void;
}) {
  const [dialog, setDialog] = useState<ApprovalAction | null>(null);
  const actions = getApprovalActions(approval, permissions);
  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes('approve') ? (
        <Button type="button" size="sm" onClick={() => setDialog('approve')} disabled={isPending}>
          Setujui
        </Button>
      ) : null}
      {actions.includes('reject') ? (
        <Button type="button" size="sm" variant="destructive" onClick={() => setDialog('reject')} disabled={isPending}>
          Tolak
        </Button>
      ) : null}
      <ConfirmDialog
        open={dialog === 'approve'}
        title="Setujui pengeluaran"
        description="Catat persetujuan Anda untuk permintaan pengeluaran ini. Posting tetap bergantung pada gerbang finansial backend."
        inputLabel="Catatan keputusan"
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(note) => {
          onApprove(note);
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        title="Tolak pengeluaran"
        description="Penolakan akan memproses pengeluaran terkait melalui aturan penolakan yang dikendalikan backend."
        confirmLabel="Tolak persetujuan"
        destructive
        reasonRequired
        inputLabel="Alasan penolakan"
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(reason) => {
          onReject(reason ?? '');
          setDialog(null);
        }}
      />
    </div>
  );
}
