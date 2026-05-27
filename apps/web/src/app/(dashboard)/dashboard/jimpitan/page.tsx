/**
 * Purpose: App Router entry for the Jimpitan operational dashboard.
 * Caller: Next.js dashboard routing.
 * Deps: SessionsPage feature component.
 * MainFuncs: Renders active officer routes and collection session shortcuts.
 * SideEffects: None.
 */
import { SessionsPage } from '@/features/jimpitan/pages/sessions-page';

export default function JimpitanPage() {
  return <SessionsPage dashboard />;
}
