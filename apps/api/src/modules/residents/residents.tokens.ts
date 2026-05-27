/**
 * Purpose: Dependency-injection tokens for resident module ports.
 * Caller: ResidentsModule providers.
 * Deps: None.
 * MainFuncs: Defines stable provider token for resident repository binding.
 * SideEffects: None.
 */
export const RESIDENTS_REPOSITORY = Symbol('RESIDENTS_REPOSITORY');
