/**
 * Purpose: NestJS module boundary for RBAC and permission management.
 * Caller: AppModule imports and protected route guard wiring.
 * Deps: RbacController, RbacService, PermissionGuard, Prisma RBAC repository.
 * MainFuncs: Registers RBAC presentation, permission evaluation, repository adapter, and exported guard.
 * SideEffects: Provides permission-check adapters through DI.
 */
import { Module } from '@nestjs/common';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RBAC_REPOSITORY } from './rbac.tokens';
import { RbacService } from './application/rbac.service';
import { PrismaRbacRepository } from './infrastructure/prisma-rbac.repository';
import { RbacController } from './presentation/rbac.controller';

@Module({
  controllers: [RbacController],
  providers: [
    RbacService,
    PermissionGuard,
    PrismaRbacRepository,
    { provide: RBAC_REPOSITORY, useExisting: PrismaRbacRepository },
  ],
  exports: [RbacService, PermissionGuard],
})
export class RbacModule {}
