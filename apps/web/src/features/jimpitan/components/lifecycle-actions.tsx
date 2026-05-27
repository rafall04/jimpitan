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
          Start
        </Button>
      ) : null}
      {actions.includes('generate-checklist') ? (
        <Button type="button" size="sm" variant="outline" onClick={onGenerate} disabled={isPending}>
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Checklist
        </Button>
      ) : null}
      {actions.includes('submit') ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog('submit')} disabled={isPending}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit
        </Button>
      ) : null}
      {actions.includes('validate') ? (
        <Button type="button" size="sm" onClick={() => setDialog('validate')} disabled={isPending}>
          <Check className="h-4 w-4" aria-hidden="true" />
          Validate
        </Button>
      ) : null}
      {actions.includes('reject') ? (
        <Button type="button" size="sm" variant="destructive" onClick={() => setDialog('reject')} disabled={isPending}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Reject
        </Button>
      ) : null}
      {actions.includes('cancel') ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setDialog('cancel')} disabled={isPending}>
          Cancel
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
  const title = action === 'submit' ? 'Submit collection' : action === 'validate' ? 'Validate collection' : action === 'reject' ? 'Reject collection' : 'Cancel collection';

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
            placeholder={requiresReason ? 'Required reason' : 'Optional validation note'}
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Back
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
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function dialogDescription(action: CollectionAction | null): string {
  if (action === 'submit') return 'Submit this session for treasurer validation. Officers cannot keep editing while it is submitted.';
  if (action === 'validate') return 'Validate this submitted session. Finance posting remains a separate backend action.';
  if (action === 'reject') return 'Reject this submitted session and send it back with a reason.';
  if (action === 'cancel') return 'Cancel this session. Validated sessions cannot be cancelled.';
  return '';
}
