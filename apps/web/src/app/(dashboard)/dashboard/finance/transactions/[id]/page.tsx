/**
 * Purpose: App Router entry for one finance transaction detail.
 * Caller: Next.js dashboard dynamic routing.
 * Deps: TransactionDetailPage feature component.
 * MainFuncs: Passes transaction id into tenant-aware finance detail workspace.
 * SideEffects: None.
 */
import { TransactionDetailPage } from '@/features/finance/pages/transaction-detail-page';

export default async function FinanceTransactionDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TransactionDetailPage transactionId={id} />;
}
