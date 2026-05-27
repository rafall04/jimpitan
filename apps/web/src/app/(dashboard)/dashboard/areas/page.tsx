/**
 * Purpose: Areas dashboard route.
 * Caller: Next.js App Router at /dashboard/areas.
 * Deps: AreasPage feature module.
 * MainFuncs: Mounts the tenant-aware area management UI.
 * SideEffects: None.
 */
import { AreasPage } from '@/features/structure/pages/areas-page';

export default function Page() {
  return <AreasPage />;
}
