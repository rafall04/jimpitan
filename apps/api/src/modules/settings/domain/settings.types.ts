/**
 * Purpose: Settings domain types — per-RT public finance (kas) visibility.
 * Caller: Settings service/repository and the reports public gate.
 * Deps: None.
 * MainFuncs: Defines the finance visibility shape, setting key, and default.
 * SideEffects: None.
 */
export type FinanceVisibilityMode = 'PUBLIC' | 'TOKEN';

export interface FinanceVisibility {
  mode: FinanceVisibilityMode;
  token: string | null;
}

export const FINANCE_VISIBILITY_KEY = 'public.finance.visibility';

export const DEFAULT_FINANCE_VISIBILITY: FinanceVisibility = { mode: 'PUBLIC', token: null };
