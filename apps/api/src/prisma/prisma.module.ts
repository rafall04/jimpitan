/**
 * Purpose: NestJS module boundary for Prisma database access.
 * Caller: AppModule and future repository providers.
 * Deps: PrismaService.
 * MainFuncs: Provides and exports the Prisma client service.
 * SideEffects: None until PrismaService lifecycle hooks run.
 */
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
