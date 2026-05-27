/**
 * Purpose: HTTP controller for tenant-scoped expense approval workflow endpoints.
 * Caller: NestJS router.
 * Deps: ApprovalsService, Auth/RBAC guards, DTOs, and request context type.
 * MainFuncs: Exposes approval policy, queue, detail, request, approve, reject, cancel, and transaction-status routes with RBAC metadata.
 * SideEffects: Writes approval, transaction rejection, policy, audit, and hook changes through ApprovalsService on mutating routes.
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
import { ApprovalsService } from '../application/approvals.service';
import {
  ApprovalDecisionDto,
  ApprovalListQueryDto,
  ApprovalQueueQueryDto,
  CancelApprovalDto,
  RejectApprovalDto,
  RequestExpenseApprovalDto,
  UpdateApprovalPolicyDto,
} from './dto/approval.dto';

@ApiTags('approvals')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, TenantGuard, PermissionGuard)
@Controller({ path: 'approvals', version: '1' })
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @ApiOperation({ summary: 'List expense approvals' })
  @RequireAnyPermission('approvals.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: ApprovalListQueryDto) {
    return this.approvalsService.listApprovals(principal, query);
  }

  @ApiOperation({ summary: 'List current approver queue' })
  @RequireAnyPermission('approvals.read', 'approvals.decide')
  @Get('queue')
  async queue(@CurrentUser() principal: AuthPrincipal, @Query() query: ApprovalQueueQueryDto) {
    return this.approvalsService.listApprovalQueue(principal, query);
  }

  @ApiOperation({ summary: 'Get expense approval policy' })
  @RequireAnyPermission('settings.read', 'approvals.read')
  @Get('policy')
  async getPolicy(@CurrentUser() principal: AuthPrincipal) {
    return this.approvalsService.getPolicy(principal);
  }

  @ApiOperation({ summary: 'Update expense approval policy' })
  @RequireAnyPermission('settings.update')
  @Patch('policy')
  async updatePolicy(@CurrentUser() principal: AuthPrincipal, @Body() dto: UpdateApprovalPolicyDto, @Req() request: RequestWithContext) {
    return this.approvalsService.updatePolicy(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get transaction approval status' })
  @RequireAnyPermission('approvals.read', 'transactions.read')
  @Get('transactions/:transactionId/status')
  async status(@CurrentUser() principal: AuthPrincipal, @Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.approvalsService.getTransactionApprovalStatus(principal, transactionId);
  }

  @ApiOperation({ summary: 'Request approvals for validated expense transaction' })
  @RequireAnyPermission('transactions.validate', 'approvals.decide')
  @Post('transactions/:transactionId/request')
  async request(
    @CurrentUser() principal: AuthPrincipal,
    @Param('transactionId', ParseUUIDPipe) transactionId: string,
    @Body() dto: RequestExpenseApprovalDto,
    @Req() request: RequestWithContext,
  ) {
    return this.approvalsService.requestApproval(principal, transactionId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get expense approval detail' })
  @RequireAnyPermission('approvals.read', 'approvals.decide')
  @Get(':approvalId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('approvalId', ParseUUIDPipe) approvalId: string) {
    return this.approvalsService.getApproval(principal, approvalId);
  }

  @ApiOperation({ summary: 'Approve expense approval request' })
  @RequireAnyPermission('approvals.decide')
  @Post(':approvalId/approve')
  async approve(
    @CurrentUser() principal: AuthPrincipal,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: ApprovalDecisionDto,
    @Req() request: RequestWithContext,
  ) {
    return this.approvalsService.approve(principal, approvalId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Reject expense approval request' })
  @RequireAnyPermission('approvals.decide')
  @Post(':approvalId/reject')
  async reject(
    @CurrentUser() principal: AuthPrincipal,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: RejectApprovalDto,
    @Req() request: RequestWithContext,
  ) {
    return this.approvalsService.reject(principal, approvalId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Cancel pending expense approval request' })
  @RequireAnyPermission('approvals.decide')
  @Post(':approvalId/cancel')
  async cancel(
    @CurrentUser() principal: AuthPrincipal,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: CancelApprovalDto,
    @Req() request: RequestWithContext,
  ) {
    return this.approvalsService.cancel(principal, approvalId, dto, this.requestMeta(request));
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
