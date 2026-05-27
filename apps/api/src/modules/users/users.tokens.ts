/**
 * Purpose: Dependency-injection tokens for user module ports.
 * Caller: UsersModule providers.
 * Deps: None.
 * MainFuncs: Defines stable provider token for user repository binding.
 * SideEffects: None.
 */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');
