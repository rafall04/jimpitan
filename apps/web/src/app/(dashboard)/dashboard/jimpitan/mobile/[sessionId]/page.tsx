/**
 * Purpose: App Router entry for the mobile Jimpitan house-by-house input flow.
 * Caller: Next.js dashboard dynamic routing.
 * Deps: MobileCollectionPage feature component.
 * MainFuncs: Passes session id into the mobile operational workflow.
 * SideEffects: None.
 */
import { MobileCollectionPage } from '@/features/jimpitan/pages/mobile-collection-page';

export default async function JimpitanMobileRoute({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <MobileCollectionPage collectionId={sessionId} />;
}
