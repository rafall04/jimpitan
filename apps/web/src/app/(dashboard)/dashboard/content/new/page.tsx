/**
 * Purpose: Create-content dashboard route.
 * Caller: Next.js App Router at /dashboard/content/new.
 * Deps: ContentCreatePage feature module.
 * MainFuncs: Mounts the content creation form.
 * SideEffects: None.
 */
import { ContentCreatePage } from '@/features/content/pages/content-create-page';

export default function Page() {
  return <ContentCreatePage />;
}
