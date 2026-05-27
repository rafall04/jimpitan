/**
 * Purpose: HTTP controller for tenant-scoped cash account endpoints.
 * Caller: NestJS router.
 * Deps: CashAccountsService, Auth/RBAC guards, DTOs, and request context type.
 * MainFuncs: Exposes cash account list/detail/default/balance/create/update/archive routes with RBAC metadata.
 * SideEffects: Writes cash account data through CashAccountsService on mutating routes.
 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isIP } from 'net';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';
import { AuthenticationGuard } from '../../../common/guards/authentication.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import type { RequestWithContext } from '../../../common/types/request-context.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { CashAccountsService } from '../application/cash-accounts.service';
import { ArchiveCashAccountDto, CashAccountQueryDto, CreateCashAccountDto, UpdateCashAccountDto } from './dto/cash-account.dto';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, TenantGuard, PermissionGuard)
@Controller({ path: 'finance/cash-accounts', version: '1' })
export class CashAccountsController {
  constructor(private readonly cashAccountsService: CashAccountsService) {}

  @ApiOperation({ summary: 'List cash accounts' })
  @RequireAnyPermission('transactions.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: CashAccountQueryDto) {
    return this.cashAccountsService.listCashAccounts(principal, query);
  }

  @ApiOperation({ summary: 'Get default cash account' })
  @RequireAnyPermission('transactions.read')
  @Get('default')
  async defaultCashAccount(@CurrentUser() principal: AuthPrincipal) {
    return this.cashAccountsService.getDefaultCashAccount(principal);
  }

  @ApiOperation({ summary: 'Create cash account' })
  @RequireAnyPermission('transactions.create')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateCashAccountDto, @Req() request: RequestWithContext) {
    return this.cashAccountsService.createCashAccount(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get cash account detail' })
  @RequireAnyPermission('transactions.read')
  @Get(':cashAccountId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string) {
    return this.cashAccountsService.getCashAccount(principal, cashAccountId);
  }

  @ApiOperation({ summary: 'Get ledger-derived cash account balance' })
  @RequireAnyPermission('transactions.read')
  @Get(':cashAccountId/balance')
  async balance(@CurrentUser() principal: AuthPrincipal, @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string) {
    return this.cashAccountsService.getCashAccountBalance(principal, cashAccountId);
  }

  @ApiOperation({ summary: 'Update cash account' })
  @RequireAnyPermission('transactions.update')
  @Patch(':cashAccountId')
  async update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string,
    @Body() dto: UpdateCashAccountDto,
    @Req() request: RequestWithContext,
  ) {
    return this.cashAccountsService.updateCashAccount(principal, cashAccountId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Archive cash account' })
  @RequireAnyPermission('transactions.delete')
  @Patch(':cashAccountId/archive')
  async archive(
    @CurrentUser() principal: AuthPrincipal,
    @Param('cashAccountId', ParseUUIDPipe) cashAccountId: string,
    @Body() dto: ArchiveCashAccountDto,
    @Req() request: RequestWithContext,
  ) {
    return this.cashAccountsService.archiveCashAccount(principal, cashAccountId, dto, this.requestMeta(request));
  }

  private requestMeta(request: RequestWithContext) {
    return {
      correlationId: request.correlationId,
      userAgent: this.headerValue(request.headers['user-agent']),
      ipAddress: request.ip && isIP(request.ip) ? request.ip : undefined,
    };
  }

  private headerValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
