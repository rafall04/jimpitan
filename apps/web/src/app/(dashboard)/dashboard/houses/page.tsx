/**
 * Purpose: Houses dashboard route.
 * Caller: Next.js App Router at /dashboard/houses.
 * Deps: HousesPage feature module.
 * MainFuncs: Mounts the tenant-aware house management UI.
 * SideEffects: None.
 */
import { HousesPage } from '@/features/structure/pages/houses-page';

export default function Page() {
  return <HousesPage />;
}
