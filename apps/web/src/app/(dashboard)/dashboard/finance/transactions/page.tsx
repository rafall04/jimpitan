/**
 * Purpose: App Router entry for finance transaction list and draft creation.
 * Caller: Next.js dashboard routing.
 * Deps: TransactionsPage feature component.
 * MainFuncs: Renders tenant-aware transaction list, filters, forms, and lifecycle controls.
 * SideEffects: None.
 */
import { TransactionsPage } from '@/features/finance/pages/transactions-page';

export default function FinanceTransactionsRoute() {
  return <TransactionsPage />;
}
