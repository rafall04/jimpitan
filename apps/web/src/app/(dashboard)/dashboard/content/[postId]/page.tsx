/**
 * Purpose: Edit-content dashboard route.
 * Caller: Next.js App Router at /dashboard/content/[postId].
 * Deps: ContentEditPage feature module.
 * MainFuncs: Resolves the post id param and mounts the content editor.
 * SideEffects: None.
 */
import { ContentEditPage } from '@/features/content/pages/content-edit-page';

export default async function Page({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return <ContentEditPage postId={postId} />;
}
