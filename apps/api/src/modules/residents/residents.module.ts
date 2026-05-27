/**
 * Purpose: NestJS module boundary for tenant-scoped resident management.
 * Caller: AppModule imports and resident route wiring.
 * Deps: AuthModule, RbacModule, ResidentsController, ResidentsService, and Prisma resident repository.
 * MainFuncs: Registers resident presentation, application, and persistence providers.
 * SideEffects: Provides resident repository binding through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { RESIDENTS_REPOSITORY } from './residents.tokens';
import { ResidentsService } from './application/residents.service';
import { PrismaResidentsRepository } from './infrastructure/prisma-residents.repository';
import { ResidentsController } from './presentation/residents.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [ResidentsController],
  providers: [
    ResidentsService,
    PrismaResidentsRepository,
    { provide: RESIDENTS_REPOSITORY, useExisting: PrismaResidentsRepository },
  ],
  exports: [ResidentsService],
})
export class ResidentsModule {}
