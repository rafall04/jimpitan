/**
 * Purpose: App Router entry for the finance operational dashboard.
 * Caller: Next.js dashboard routing.
 * Deps: FinanceDashboardPage feature component.
 * MainFuncs: Renders tenant-aware finance balances, workflow queues, ledger preview, and collection posting.
 * SideEffects: None.
 */
import { FinanceDashboardPage } from '@/features/finance/pages/finance-dashboard-page';

export default function FinancePage() {
  return <FinanceDashboardPage />;
}
