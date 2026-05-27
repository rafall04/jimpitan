/**
 * Purpose: Dependency-injection tokens for house and area module ports.
 * Caller: HousesModule providers.
 * Deps: None.
 * MainFuncs: Defines stable provider token for physical-structure repository binding.
 * SideEffects: None.
 */
export const HOUSES_REPOSITORY = Symbol('HOUSES_REPOSITORY');
