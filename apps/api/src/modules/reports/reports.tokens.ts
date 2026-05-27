/**
 * Purpose: Dependency-injection tokens for reporting module ports.
 * Caller: ReportsModule providers and report services.
 * Deps: None.
 * MainFuncs: Defines stable provider token for reporting persistence.
 * SideEffects: None.
 */
export const REPORTS_REPOSITORY = Symbol('REPORTS_REPOSITORY');
