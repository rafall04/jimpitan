/**
 * Purpose: Dependency-injection tokens for tenant module ports.
 * Caller: TenantsModule providers.
 * Deps: None.
 * MainFuncs: Defines stable provider token for tenant repository binding.
 * SideEffects: None.
 */
export const TENANTS_REPOSITORY = Symbol('TENANTS_REPOSITORY');
