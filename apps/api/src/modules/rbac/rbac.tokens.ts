/**
 * Purpose: Dependency-injection tokens for RBAC module ports.
 * Caller: RbacModule providers.
 * Deps: None.
 * MainFuncs: Defines stable provider token for RBAC repository binding.
 * SideEffects: None.
 */
export const RBAC_REPOSITORY = Symbol('RBAC_REPOSITORY');
