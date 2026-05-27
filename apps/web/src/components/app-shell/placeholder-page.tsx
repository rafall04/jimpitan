/**
 * Purpose: Standard placeholder page for scaffolded feature routes.
 * Caller: Public and private placeholder pages.
 * Deps: EmptyState component.
 * MainFuncs: Communicates reserved route state without fake business data.
 * SideEffects: None.
 */
import { EmptyState } from '@/components/feedback/empty-state';

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <main id="main-content" className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
      <EmptyState title={title} description={description} />
    </main>
  );
}
