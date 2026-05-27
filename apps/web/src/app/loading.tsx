/**
 * Purpose: Route-level loading fallback for App Router transitions.
 * Caller: Next.js App Router.
 * Deps: LoadingState component.
 * MainFuncs: Shows an accessible loading state without business data.
 * SideEffects: None.
 */
import { LoadingState } from '@/components/feedback/loading-state';

export default function Loading() {
  return <LoadingState label="Loading page" />;
}
