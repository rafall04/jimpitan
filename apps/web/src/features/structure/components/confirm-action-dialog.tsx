/**
 * Purpose: Reusable confirmation dialog for archive/reactivate structure actions.
 * Caller: Residents, Houses, and Areas pages.
 * Deps: Dialog and Button UI primitives.
 * MainFuncs: Presents accessible confirmation copy and invokes caller mutation.
 * SideEffects: Invokes caller-provided action when confirmed.
 */
'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ConfirmActionDialog({
  open,
  title,
  description,
  actionLabel,
  destructive = false,
  isPending = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  isPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Working' : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
