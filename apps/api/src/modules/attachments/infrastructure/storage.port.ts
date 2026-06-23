/**
 * Purpose: Object-storage port abstraction so the attachment workflow is storage-backend agnostic.
 * Caller: AttachmentsService (via STORAGE_PORT token); implemented by LocalDiskStorageAdapter (and a future S3 adapter).
 * Deps: None.
 * MainFuncs: Declares put/get/delete operations and the logical bucket identifier.
 * SideEffects: None (interface only).
 */
export interface StoragePutInput {
  objectKey: string;
  data: Buffer;
  contentType: string;
}

export interface StoragePort {
  readonly bucket: string;
  put(input: StoragePutInput): Promise<void>;
  get(objectKey: string): Promise<Buffer>;
  delete(objectKey: string): Promise<void>;
}
