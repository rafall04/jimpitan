/**
 * Purpose: HTTP controller for tenant-scoped finance transaction endpoints.
 * Caller: NestJS router.
 * Deps: FinanceTransactionsService, Auth/RBAC guards, DTOs, and request context type.
 * MainFuncs: Exposes transaction list/detail/create/validate/reject/void/post and collection posting routes with RBAC metadata.
 * SideEffects: Writes finance transactions and ledger entries through FinanceTransactionsService on mutating routes.
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
import { FinanceTransactionsService } from '../application/finance-transactions.service';
import {
  CreateFinanceTransactionDto,
  FinanceTransactionQueryDto,
  PostFinanceTransactionDto,
  PostValidatedCollectionDto,
  RejectFinanceTransactionDto,
  ValidateFinanceTransactionDto,
  VoidFinanceTransactionDto,
} from './dto/finance-transaction.dto';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, TenantGuard, PermissionGuard)
@Controller({ path: 'finance/transactions', version: '1' })
export class FinanceTransactionsController {
  constructor(private readonly transactionsService: FinanceTransactionsService) {}

  @ApiOperation({ summary: 'List finance transactions' })
  @RequireAnyPermission('transactions.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: FinanceTransactionQueryDto) {
    return this.transactionsService.listTransactions(principal, query);
  }

  @ApiOperation({ summary: 'Create income transaction draft' })
  @RequireAnyPermission('transactions.create')
  @Post('income')
  async createIncome(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateFinanceTransactionDto, @Req() request: RequestWithContext) {
    return this.transactionsService.createIncomeDraft(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Create expense transaction draft' })
  @RequireAnyPermission('transactions.create')
  @Post('expense')
  async createExpense(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateFinanceTransactionDto, @Req() request: RequestWithContext) {
    return this.transactionsService.createExpenseDraft(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Post validated jimpitan collection into finance transaction' })
  @RequireAnyPermission('transactions.post')
  @Post('source-collections')
  async postCollection(@CurrentUser() principal: AuthPrincipal, @Body() dto: PostValidatedCollectionDto, @Req() request: RequestWithContext) {
    return this.transactionsService.postValidatedCollection(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get finance transaction detail' })
  @RequireAnyPermission('transactions.read')
  @Get(':transactionId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.transactionsService.getTransaction(principal, transactionId);
  }

  @ApiOperation({ summary: 'Validate finance transaction' })
  @RequireAnyPermission('transactions.validate')
  @Patch(':transactionId/validate')
  async validate(
    @CurrentUser() principal: AuthPrincipal,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: ValidateFinanceTransactionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.transactionsService.validateTransaction(principal, transactionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Reject finance transaction' })
  @RequireAnyPermission('transactions.validate')
  @Patch(':transactionId/reject')
  async reject(
    @CurrentUser() principal: AuthPrincipal,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: RejectFinanceTransactionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.transactionsService.rejectTransaction(principal, transactionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Void draft finance transaction only' })
  @RequireAnyPermission('transactions.delete')
  @Patch(':transactionId/void')
  async voidDraft(
    @CurrentUser() principal: AuthPrincipal,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: VoidFinanceTransactionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.transactionsService.voidDraftTransaction(principal, transactionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Post validated finance transaction to append-only ledger' })
  @RequireAnyPermission('transactions.post')
  @Patch(':transactionId/post')
  async post(
    @CurrentUser() principal: AuthPrincipal,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: PostFinanceTransactionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.transactionsService.postTransaction(principal, transactionId, dto, this.requestMeta(request));
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
