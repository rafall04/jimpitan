/**
 * Purpose: App Router entry for one Jimpitan collection session detail.
 * Caller: Next.js dashboard dynamic routing.
 * Deps: SessionDetailPage feature component.
 * MainFuncs: Passes the route collection id into the tenant-aware detail workspace.
 * SideEffects: None.
 */
import { SessionDetailPage } from '@/features/jimpitan/pages/session-detail-page';

export default async function JimpitanSessionDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionDetailPage collectionId={id} />;
}
