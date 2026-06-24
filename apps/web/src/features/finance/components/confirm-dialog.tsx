/**
 * Purpose: Accessible confirmation dialog for finance posting, rejection, voiding, and approvals.
 * Caller: Finance and approval lifecycle controls.
 * Deps: Dialog and Button primitives.
 * MainFuncs: Collects optional notes or required reasons and makes critical actions explicit.
 * SideEffects: Invokes caller-provided confirmation handlers.
 */
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Konfirmasi',
  destructive = false,
  reasonRequired = false,
  inputLabel = 'Alasan atau catatan',
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  reasonRequired?: boolean;
  inputLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (text?: string) => void;
}) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (!open) {
      setText('');
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <label className="space-y-2 text-sm">
          <span>{inputLabel}</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} disabled={reasonRequired && text.trim().length < 2} onClick={() => onConfirm(text.trim() || undefined)}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
