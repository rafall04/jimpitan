/**
 * Purpose: NestJS module boundary for tenant-scoped houses and areas.
 * Caller: AppModule imports and house/area route wiring.
 * Deps: AuthModule, RbacModule, controllers, services, and Prisma house repository.
 * MainFuncs: Registers physical RT structure presentation, application, and persistence providers.
 * SideEffects: Provides house repository binding through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { HOUSES_REPOSITORY } from './houses.tokens';
import { AreasService } from './application/areas.service';
import { HousesService } from './application/houses.service';
import { PrismaHousesRepository } from './infrastructure/prisma-houses.repository';
import { AreasController } from './presentation/areas.controller';
import { HousesController } from './presentation/houses.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [AreasController, HousesController],
  providers: [
    AreasService,
    HousesService,
    PrismaHousesRepository,
    { provide: HOUSES_REPOSITORY, useExisting: PrismaHousesRepository },
  ],
  exports: [AreasService, HousesService],
})
export class HousesModule {}
