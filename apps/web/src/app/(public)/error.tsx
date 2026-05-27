/**
 * Purpose: Public route error boundary.
 * Caller: Next.js App Router when public report server data loading fails.
 * Deps: ErrorState component.
 * MainFuncs: Shows a non-sensitive retryable public API error state.
 * SideEffects: Invokes router retry when the user requests a reload.
 */
'use client';

import { ErrorState } from '@/components/feedback/error-state';

export default function PublicError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState title="Laporan publik belum tersedia" description="Data publik tidak dapat dimuat saat ini. Tidak ada data pribadi yang ditampilkan." actionLabel="Coba lagi" onAction={reset} />;
}
