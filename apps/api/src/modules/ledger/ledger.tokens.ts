/**
 * Purpose: Dependency-injection tokens for ledger module ports.
 * Caller: LedgerModule providers and future repository adapters.
 * Deps: None.
 * MainFuncs: Defines stable provider tokens for append-only ledger persistence boundaries.
 * SideEffects: None.
 */
export const LEDGER_REPOSITORY = Symbol('LEDGER_REPOSITORY');
