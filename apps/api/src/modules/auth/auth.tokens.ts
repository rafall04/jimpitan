/**
 * Purpose: Dependency injection tokens for Auth module ports.
 * Caller: AuthModule provider wiring and AuthService constructor injection.
 * Deps: None.
 * MainFuncs: Defines stable symbols for Auth repository, hashing, and token ports.
 * SideEffects: None.
 */
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const AUTH_TOKEN_SERVICE = Symbol('AUTH_TOKEN_SERVICE');
