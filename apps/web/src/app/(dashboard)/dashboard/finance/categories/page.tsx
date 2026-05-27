/**
 * Purpose: App Router entry for transaction category management.
 * Caller: Next.js dashboard routing.
 * Deps: CategoriesPage feature component.
 * MainFuncs: Renders tenant-aware finance category list and management forms.
 * SideEffects: None.
 */
import { CategoriesPage } from '@/features/finance/pages/categories-page';

export default function FinanceCategoriesRoute() {
  return <CategoriesPage />;
}
