/**
 * Purpose: App Router entry for the expense approval queue.
 * Caller: Next.js dashboard routing.
 * Deps: ApprovalsPage feature component.
 * MainFuncs: Renders tenant-aware approval queue and decision controls.
 * SideEffects: None.
 */
import { ApprovalsPage as ApprovalQueuePage } from '@/features/finance/pages/approvals-page';

export default function ApprovalsPage() {
  return <ApprovalQueuePage />;
}
