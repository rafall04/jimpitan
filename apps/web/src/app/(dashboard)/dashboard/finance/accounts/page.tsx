/**
 * Purpose: App Router entry for finance cash account management.
 * Caller: Next.js dashboard routing.
 * Deps: AccountsPage feature component.
 * MainFuncs: Renders tenant-aware cash account list and management forms.
 * SideEffects: None.
 */
import { AccountsPage } from '@/features/finance/pages/accounts-page';

export default function FinanceAccountsRoute() {
  return <AccountsPage />;
}
