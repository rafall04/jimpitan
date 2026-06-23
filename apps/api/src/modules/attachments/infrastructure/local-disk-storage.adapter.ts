/**
 * Purpose: Local-volume implementation of the object-storage port (writes uploads under UPLOAD_STORAGE_PATH).
 * Caller: AttachmentsModule binds it to STORAGE_PORT; AttachmentsService uses it to persist/serve image bytes.
 * Deps: node:fs/promises, node:path, ConfigService (storage.uploadPath, storage.uploadBucket).
 * MainFuncs: put/get/delete object bytes on disk with strict path-traversal containment under the storage root.
 * SideEffects: Creates directories and reads/writes/removes files on the local filesystem.
 */
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { StoragePort, StoragePutInput } from './storage.port';

@Injectable()
export class LocalDiskStorageAdapter implements StoragePort {
  private readonly root: string;
  readonly bucket: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.root = resolve(config.get<string>('storage.uploadPath', '/var/lib/jimpitan/uploads'));
    this.bucket = config.get<string>('storage.uploadBucket', 'local-uploads');
  }

  async put(input: StoragePutInput): Promise<void> {
    const fullPath = this.resolveObjectPath(input.objectKey);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, input.data);
  }

  async get(objectKey: string): Promise<Buffer> {
    return readFile(this.resolveObjectPath(objectKey));
  }

  async delete(objectKey: string): Promise<void> {
    await rm(this.resolveObjectPath(objectKey), { force: true });
  }

  // Resolve an object key under the storage root, refusing any key that escapes it.
  private resolveObjectPath(objectKey: string): string {
    const safeKey = objectKey.replace(/\\/g, '/').replace(/^(?:\.\.?\/)+/, '').replace(/^\/+/, '');
    const fullPath = resolve(this.root, safeKey);
    if (fullPath !== this.root && !fullPath.startsWith(this.root + sep)) {
      throw new Error('Resolved storage path escapes the storage root.');
    }
    return fullPath;
  }
}
