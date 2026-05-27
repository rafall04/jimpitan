/**
 * Purpose: Not-found fallback for unknown frontend routes.
 * Caller: Next.js App Router.
 * Deps: next/link and EmptyState component.
 * MainFuncs: Provides an accessible route recovery path.
 * SideEffects: None.
 */
import Link from 'next/link';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <EmptyState title="Page not found" description="The requested route is not available in this shell.">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </EmptyState>
    </main>
  );
}
