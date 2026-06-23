/**
 * Purpose: NestJS module boundary for file attachments (local-disk object storage + image metadata).
 * Caller: AppModule imports; ContentModule imports it to upload/list/delete content images.
 * Deps: AttachmentsController, AttachmentsService, LocalDiskStorageAdapter, PrismaAttachmentsRepository, storage + repository tokens.
 * MainFuncs: Wires the storage port, attachment repository, and attachment service; exposes the public image-serve route.
 * SideEffects: Provides AttachmentsService and storage bindings through DI.
 */
import { Module } from '@nestjs/common';
import { ATTACHMENTS_REPOSITORY, STORAGE_PORT } from './attachments.tokens';
import { AttachmentsService } from './application/attachments.service';
import { LocalDiskStorageAdapter } from './infrastructure/local-disk-storage.adapter';
import { PrismaAttachmentsRepository } from './infrastructure/prisma-attachments.repository';
import { AttachmentsController } from './presentation/attachments.controller';

@Module({
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    LocalDiskStorageAdapter,
    PrismaAttachmentsRepository,
    { provide: STORAGE_PORT, useExisting: LocalDiskStorageAdapter },
    { provide: ATTACHMENTS_REPOSITORY, useExisting: PrismaAttachmentsRepository },
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
