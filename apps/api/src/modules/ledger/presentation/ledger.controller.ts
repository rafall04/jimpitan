/**
 * Purpose: HTTP controller for tenant-scoped append-only cash ledger endpoints.
 * Caller: NestJS router.
 * Deps: LedgerService, Auth/RBAC guards, and ledger query DTO.
 * MainFuncs: Exposes ledger listing, detail, and balance routes with RBAC metadata.
 * SideEffects: Reads ledger data through LedgerService.
 */
import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { LedgerService } from '../application/ledger.service';
import { LedgerEntryQueryDto } from './dto/ledger-query.dto';

@ApiTags('ledger')
@ApiBearerAuth()@Controller({ path: 'ledger', version: '1' })
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @ApiOperation({ summary: 'List append-only cash ledger entries' })
  @RequireAnyPermission('transactions.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: LedgerEntryQueryDto) {
    return this.ledgerService.listLedgerEntries(principal, query);
  }

  @ApiOperation({ summary: 'Get ledger-derived cash account balance' })
  @RequireAnyPermission('transactions.read')
  @Get('cash-accounts/:cashAccountId/balance')
  async balance(@CurrentUser() principal: AuthPrincipal, @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string) {
    return this.ledgerService.getCashAccountBalance(principal, cashAccountId);
  }

  @ApiOperation({ summary: 'Get cash ledger entry detail' })
  @RequireAnyPermission('transactions.read')
  @Get(':ledgerEntryId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('ledgerEntryId', ParseUUIDPipe) ledgerEntryId: string) {
    return this.ledgerService.getLedgerEntry(principal, ledgerEntryId);
  }
}
