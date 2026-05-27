/**
 * Purpose: Dependency-injection tokens for finance module ports.
 * Caller: FinanceModule providers and future repository adapters.
 * Deps: None.
 * MainFuncs: Defines stable provider tokens for finance persistence and collection posting boundaries.
 * SideEffects: None.
 */
export const FINANCE_REPOSITORY = Symbol('FINANCE_REPOSITORY');
export const COLLECTION_POSTING_SERVICE = Symbol('COLLECTION_POSTING_SERVICE');
