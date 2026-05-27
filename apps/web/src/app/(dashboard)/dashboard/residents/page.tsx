/**
 * Purpose: Residents dashboard route.
 * Caller: Next.js App Router at /dashboard/residents.
 * Deps: ResidentsPage feature module.
 * MainFuncs: Mounts the tenant-aware resident management UI.
 * SideEffects: None.
 */
import { ResidentsPage } from '@/features/structure/pages/residents-page';

export default function Page() {
  return <ResidentsPage />;
}
