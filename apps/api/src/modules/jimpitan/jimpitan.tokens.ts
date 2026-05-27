/**
 * Purpose: Dependency-injection tokens for jimpitan module ports.
 * Caller: JimpitanModule providers.
 * Deps: None.
 * MainFuncs: Defines stable provider tokens for collection repository and workflow hooks.
 * SideEffects: None.
 */
export const JIMPITAN_REPOSITORY = Symbol('JIMPITAN_REPOSITORY');
export const JIMPITAN_HOOKS = Symbol('JIMPITAN_HOOKS');
