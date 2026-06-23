/**
 * Purpose: NestJS module boundary for tenant-scoped content (announcements, activities, articles, galleries) + public reads.
 * Caller: AppModule imports and content route wiring.
 * Deps: AuthModule, RbacModule, AttachmentsModule, ContentController, PublicContentController, ContentService, Prisma content repository.
 * MainFuncs: Registers content authoring + public presentation, application, and persistence providers.
 * SideEffects: Provides ContentService and content repository binding through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { CONTENT_REPOSITORY } from './content.tokens';
import { ContentService } from './application/content.service';
import { PrismaContentRepository } from './infrastructure/prisma-content.repository';
import { ContentController } from './presentation/content.controller';
import { PublicContentController } from './presentation/public-content.controller';

@Module({
  imports: [AuthModule, RbacModule, AttachmentsModule],
  controllers: [ContentController, PublicContentController],
  providers: [
    ContentService,
    PrismaContentRepository,
    { provide: CONTENT_REPOSITORY, useExisting: PrismaContentRepository },
  ],
  exports: [ContentService],
})
export class ContentModule {}
