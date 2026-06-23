/**
 * Purpose: Dashboard home (RT overview) route.
 * Caller: App Router route at /dashboard.
 * Deps: OverviewPage feature component.
 * MainFuncs: Mounts the tenant-aware dashboard overview.
 * SideEffects: None.
 */
import { OverviewPage } from '@/features/dashboard/overview-page';

export default function DashboardPage() {
  return <OverviewPage />;
}
