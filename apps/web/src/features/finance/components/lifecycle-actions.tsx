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
          Validate
        </Button>
      ) : null}
      {actions.includes('post') ? (
        <Button type="button" size="sm" onClick={() => setDialog('post')} disabled={isPending}>
          Post
        </Button>
      ) : null}
      {actions.includes('reject') ? (
        <Button type="button" size="sm" variant="destructive" onClick={() => setDialog('reject')} disabled={isPending}>
          Reject
        </Button>
      ) : null}
      {actions.includes('void') ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog('void')} disabled={isPending}>
          Void draft
        </Button>
      ) : null}
      <ConfirmDialog
        open={dialog === 'validate'}
        title="Validate transaction"
        description="Validate this draft for posting or approval evaluation. Backend rules remain authoritative."
        inputLabel="Validation note"
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(note) => {
          onValidate(note);
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'post'}
        title="Post transaction"
        description="Posting writes append-only ledger entries. Posted transactions are immutable and corrections require adjustments."
        confirmLabel="Post transaction"
        inputLabel="Optional posting note"
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={() => {
          onPost();
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        title="Reject transaction"
        description="Rejected transactions cannot be posted. Provide an audit-friendly reason."
        confirmLabel="Reject"
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
        title="Void draft"
        description="Only draft transactions can be voided. Provide a reason for the audit trail."
        confirmLabel="Void draft"
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
          Approve
        </Button>
      ) : null}
      {actions.includes('reject') ? (
        <Button type="button" size="sm" variant="destructive" onClick={() => setDialog('reject')} disabled={isPending}>
          Reject
        </Button>
      ) : null}
      <ConfirmDialog
        open={dialog === 'approve'}
        title="Approve expense"
        description="Record your approval for this expense request. Posting still depends on backend finance gates."
        inputLabel="Decision note"
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(note) => {
          onApprove(note);
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        title="Reject expense"
        description="Rejected approvals move the related expense through backend-controlled rejection rules."
        confirmLabel="Reject approval"
        destructive
        reasonRequired
        inputLabel="Rejection reason"
        onOpenChange={(open) => !open && setDialog(null)}
        onConfirm={(reason) => {
          onReject(reason ?? '');
          setDialog(null);
        }}
      />
    </div>
  );
}
