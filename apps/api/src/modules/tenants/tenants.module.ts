/**
 * Purpose: NestJS module boundary for RT tenant management.
 * Caller: AppModule imports and tenant route wiring.
 * Deps: AuthModule, RbacModule, TenantsController, TenantsService, Prisma tenant repository.
 * MainFuncs: Registers RT tenant presentation, application, and persistence providers.
 * SideEffects: Provides tenant repository binding through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { TENANTS_REPOSITORY } from './tenants.tokens';
import { TenantsService } from './application/tenants.service';
import { PrismaTenantsRepository } from './infrastructure/prisma-tenants.repository';
import { TenantsController } from './presentation/tenants.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [TenantsController],
  providers: [
    TenantsService,
    PrismaTenantsRepository,
    { provide: TENANTS_REPOSITORY, useExisting: PrismaTenantsRepository },
  ],
})
export class TenantsModule {}
