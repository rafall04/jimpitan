/**
 * Purpose: App Router entry for one expense approval detail.
 * Caller: Next.js dashboard dynamic routing.
 * Deps: ApprovalDetailPage feature component.
 * MainFuncs: Passes approval id into tenant-aware approval detail workspace.
 * SideEffects: None.
 */
import { ApprovalDetailPage } from '@/features/finance/pages/approval-detail-page';

export default async function ApprovalDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApprovalDetailPage approvalId={id} />;
}
