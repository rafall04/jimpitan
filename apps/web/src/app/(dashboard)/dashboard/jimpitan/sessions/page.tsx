/**
 * Purpose: App Router entry for all Jimpitan collection sessions.
 * Caller: Next.js dashboard routing.
 * Deps: SessionsPage feature component.
 * MainFuncs: Renders tenant-aware session list and creation workflow.
 * SideEffects: None.
 */
import { SessionsPage } from '@/features/jimpitan/pages/sessions-page';

export default function JimpitanSessionsPage() {
  return <SessionsPage />;
}
