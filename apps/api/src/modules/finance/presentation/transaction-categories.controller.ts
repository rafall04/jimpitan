/**
 * Purpose: HTTP controller for tenant-scoped transaction category endpoints.
 * Caller: NestJS router.
 * Deps: TransactionCategoriesService, Auth/RBAC guards, DTOs, and request context type.
 * MainFuncs: Exposes category list/detail/create/update/archive routes with RBAC metadata.
 * SideEffects: Writes transaction category data through TransactionCategoriesService on mutating routes.
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
import { TransactionCategoriesService } from '../application/transaction-categories.service';
import { ArchiveTransactionCategoryDto, CreateTransactionCategoryDto, TransactionCategoryQueryDto, UpdateTransactionCategoryDto } from './dto/transaction-category.dto';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, TenantGuard, PermissionGuard)
@Controller({ path: 'finance/categories', version: '1' })
export class TransactionCategoriesController {
  constructor(private readonly categoriesService: TransactionCategoriesService) {}

  @ApiOperation({ summary: 'List transaction categories' })
  @RequireAnyPermission('transactions.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: TransactionCategoryQueryDto) {
    return this.categoriesService.listCategories(principal, query);
  }

  @ApiOperation({ summary: 'Create transaction category' })
  @RequireAnyPermission('transactions.create')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateTransactionCategoryDto, @Req() request: RequestWithContext) {
    return this.categoriesService.createCategory(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get transaction category detail' })
  @RequireAnyPermission('transactions.read')
  @Get(':categoryId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.categoriesService.getCategory(principal, categoryId);
  }

  @ApiOperation({ summary: 'Update transaction category' })
  @RequireAnyPermission('transactions.update')
  @Patch(':categoryId')
  async update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateTransactionCategoryDto,
    @Req() request: RequestWithContext,
  ) {
    return this.categoriesService.updateCategory(principal, categoryId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Archive transaction category' })
  @RequireAnyPermission('transactions.delete')
  @Patch(':categoryId/archive')
  async archive(
    @CurrentUser() principal: AuthPrincipal,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: ArchiveTransactionCategoryDto,
    @Req() request: RequestWithContext,
  ) {
    return this.categoriesService.archiveCategory(principal, categoryId, dto, this.requestMeta(request));
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
