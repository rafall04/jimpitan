/**
 * Purpose: NestJS module boundary for file attachments.
 * Caller: AppModule imports and future attachment route wiring.
 * Deps: AttachmentsController, AttachmentsService.
 * MainFuncs: Registers attachment presentation and application skeletons.
 * SideEffects: None.
 */
import { Module } from '@nestjs/common';
import { AttachmentsService } from './application/attachments.service';
import { AttachmentsController } from './presentation/attachments.controller';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService],
})
export class AttachmentsModule {}
