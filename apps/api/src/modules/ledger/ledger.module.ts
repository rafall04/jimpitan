/**
 * Purpose: NestJS module boundary for append-only cash ledger reads and future posting consistency.
 * Caller: AppModule imports and future ledger route wiring.
 * Deps: AuthModule, RbacModule, LedgerController, LedgerService.
 * MainFuncs: Registers ledger presentation and application scaffolds.
 * SideEffects: Provides ledger service through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { LEDGER_REPOSITORY } from './ledger.tokens';
import { LedgerService } from './application/ledger.service';
import { PrismaLedgerRepository } from './infrastructure/prisma-ledger.repository';
import { LedgerController } from './presentation/ledger.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [LedgerController],
  providers: [LedgerService, PrismaLedgerRepository, { provide: LEDGER_REPOSITORY, useExisting: PrismaLedgerRepository }],
  exports: [LedgerService],
})
export class LedgerModule {}
