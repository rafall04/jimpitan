/**
 * Purpose: Loading skeleton for public transparency routes.
 * Caller: Next.js App Router while public server route data is pending.
 * Deps: PublicRouteLoadingSkeleton component.
 * MainFuncs: Shows accessible mobile-first skeletons without fake business data.
 * SideEffects: None.
 */
import { PublicRouteLoadingSkeleton } from '@/features/public-reports/components';

export default function PublicLoading() {
  return <PublicRouteLoadingSkeleton label="Memuat laporan publik" />;
}
