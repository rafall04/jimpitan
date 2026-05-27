/**
 * Purpose: Root client error boundary for unexpected App Router failures.
 * Caller: Next.js App Router.
 * Deps: ErrorState component.
 * MainFuncs: Presents a retry action while avoiding sensitive error details.
 * SideEffects: Invokes Next.js reset callback when requested.
 */
'use client';

import { ErrorState } from '@/components/feedback/error-state';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body>
        <ErrorState title="Something went wrong" description="The page could not be rendered." actionLabel="Try again" onAction={reset} />
      </body>
    </html>
  );
}
