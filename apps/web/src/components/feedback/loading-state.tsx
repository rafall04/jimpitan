/**
 * Purpose: Generic loading state foundation.
 * Caller: Route loading fallback and future feature loading surfaces.
 * Deps: Skeleton primitive.
 * MainFuncs: Provides accessible progress feedback without fake business data.
 * SideEffects: None.
 */
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState({ label }: { label: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </main>
  );
}
