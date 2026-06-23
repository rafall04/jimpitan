/**
 * Purpose: Content management dashboard route.
 * Caller: Next.js App Router at /dashboard/content.
 * Deps: ContentListPage feature module.
 * MainFuncs: Mounts the tenant-aware content list/management UI.
 * SideEffects: None.
 */
import { ContentListPage } from '@/features/content/pages/content-list-page';

export default function Page() {
  return <ContentListPage />;
}
