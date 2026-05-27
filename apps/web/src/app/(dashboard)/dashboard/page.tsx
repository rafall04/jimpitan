/**
 * Purpose: Dashboard overview placeholder route.
 * Caller: App Router route at /dashboard.
 * Deps: PlaceholderPage component.
 * MainFuncs: Reserves private dashboard overview without business metrics.
 * SideEffects: None.
 */
import { PlaceholderPage } from '@/components/app-shell/placeholder-page';

export default function DashboardPage() {
  return <PlaceholderPage title="Dashboard" description="Private RT overview shell is ready for future business widgets." />;
}
