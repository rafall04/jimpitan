/**
 * Purpose: Frontend types for per-RT settings (public finance visibility).
 * Caller: Settings API adapter, hooks, and page.
 * Deps: None.
 * MainFuncs: Mirrors the backend finance visibility contract.
 * SideEffects: None.
 */
export type FinanceVisibilityMode = 'PUBLIC' | 'TOKEN';

export interface FinanceVisibility {
  mode: FinanceVisibilityMode;
  token: string | null;
}
