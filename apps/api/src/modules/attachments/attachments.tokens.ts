/**
 * Purpose: Stable dependency-injection tokens for attachment persistence and object storage.
 * Caller: AttachmentsModule, AttachmentsService, storage adapters.
 * Deps: None.
 * MainFuncs: Defines repository and storage provider tokens.
 * SideEffects: None.
 */
export const ATTACHMENTS_REPOSITORY = Symbol('ATTACHMENTS_REPOSITORY');
export const STORAGE_PORT = Symbol('STORAGE_PORT');
