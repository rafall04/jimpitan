/**
 * Purpose: Avatar primitive with image + initials fallback.
 * Caller: User/resident rows, author bylines.
 * Deps: React, cn utility.
 * MainFuncs: Renders a circular avatar from a name (initials) and optional image source.
 * SideEffects: None.
 */
import { cn } from '@/lib/utils/cn';

function initialsOf(name: string): string {
  const parts = (name ?? '').trim().split(/\s+/).map((part) => part[0]).filter(Boolean);
  return parts.slice(0, 2).join('').toUpperCase() || '?';
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-medium text-primary', className)} aria-hidden={!src}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
