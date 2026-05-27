/**
 * Purpose: App Router entry for read-only cash ledger.
 * Caller: Next.js dashboard routing.
 * Deps: LedgerPage feature component.
 * MainFuncs: Renders tenant-aware append-only ledger table.
 * SideEffects: None.
 */
import { LedgerPage } from '@/features/finance/pages/ledger-page';

export default function FinanceLedgerRoute() {
  return <LedgerPage />;
}
