/**
 * Purpose: Public, anonymous reaction control for a content post.
 * Caller: PublicContentDetailView.
 * Deps: public content API, Button primitive, sonner.
 * MainFuncs: Sends a reaction and reflects the returned per-type breakdown + total.
 * SideEffects: Performs a public reaction POST (one reaction per visitor, deduped server-side).
 */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { reactToPublicContent } from './api';
import type { ReactionType } from './types';

const OPTIONS: { value: ReactionType; emoji: string; label: string }[] = [
  { value: 'LIKE', emoji: '👍', label: 'Suka' },
  { value: 'LOVE', emoji: '❤️', label: 'Suka sekali' },
  { value: 'SUPPORT', emoji: '🙌', label: 'Semangat' },
];

export function ReactionBar({
  rtCode,
  typePath,
  slug,
  initialBreakdown,
  initialCount,
}: {
  rtCode: string;
  typePath: string;
  slug: string;
  initialBreakdown: Record<ReactionType, number>;
  initialCount: number;
}) {
  const [breakdown, setBreakdown] = useState(initialBreakdown);
  const [total, setTotal] = useState(initialCount);
  const [pending, setPending] = useState<ReactionType | null>(null);
  const [reacted, setReacted] = useState<ReactionType | null>(null);

  async function react(type: ReactionType) {
    setPending(type);
    try {
      const result = await reactToPublicContent(rtCode, typePath, slug, type);
      setBreakdown(result.reactionBreakdown);
      setTotal(result.reactionCount);
      setReacted(result.reactionType);
    } catch {
      toast.error('Gagal mengirim reaksi. Coba lagi.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <p className="text-sm font-medium">Suka dengan konten ini?</p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={reacted === option.value ? 'default' : 'outline'}
            size="sm"
            disabled={pending !== null}
            onClick={() => void react(option.value)}
            aria-pressed={reacted === option.value}
          >
            <span aria-hidden="true">{option.emoji}</span>
            <span>{option.label}</span>
            <span className="tabular-nums">{breakdown[option.value] ?? 0}</span>
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{total} reaksi · satu reaksi per pengunjung · ketuk lagi untuk batal</p>
    </div>
  );
}
