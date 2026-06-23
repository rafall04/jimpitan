/**
 * Purpose: Dependency-injection token for the content repository port.
 * Caller: ContentModule providers and ContentService.
 * Deps: None.
 * MainFuncs: Defines the stable provider token for content persistence binding.
 * SideEffects: None.
 */
export const CONTENT_REPOSITORY = Symbol('CONTENT_REPOSITORY');
