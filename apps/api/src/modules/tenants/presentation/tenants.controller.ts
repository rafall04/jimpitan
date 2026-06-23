/**
 * Purpose: HTTP controller for RT tenant foundation endpoints.
 * Caller: NestJS router.
 * Deps: TenantsService, auth/RBAC guards, tenant DTOs, pagination DTO.
 * MainFuncs: Exposes current tenant resolver and minimal RT CRUD endpoints.
 * SideEffects: Writes RT tenant data through TenantsService for mutating routes.
 */
import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';
import { SkipTenantGuard } from '../../../common/decorators/skip-tenant-guard.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { RequestWithContext } from '../../../common/types/request-context.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { TenantsService } from '../application/tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@ApiTags('tenants')
@ApiBearerAuth()
@SkipTenantGuard()
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('current')
  async current(@CurrentUser() principal: AuthPrincipal) {
    return this.tenantsService.getCurrentTenant(principal);
  }

  @RequireAnyPermission('settings.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: PaginationQueryDto) {
    return this.tenantsService.listTenants(principal, query);
  }

  @RequireAnyPermission('settings.update')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateTenantDto, @Req() request: RequestWithContext) {
    return this.tenantsService.createTenant(principal, dto, { correlationId: request.correlationId });
  }

  @RequireAnyPermission('settings.read')
  @Get(':rtId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('rtId', ParseUUIDPipe) rtId: string) {
    return this.tenantsService.getTenant(principal, rtId);
  }

  @RequireAnyPermission('settings.update')
  @Patch(':rtId')
  async update(@CurrentUser() principal: AuthPrincipal, @Param('rtId', ParseUUIDPipe) rtId: string, @Body() dto: UpdateTenantDto, @Req() request: RequestWithContext) {
    return this.tenantsService.updateTenant(principal, rtId, dto, { correlationId: request.correlationId });
  }

  @RequireAnyPermission('settings.update')
  @Delete(':rtId')
  @HttpCode(204)
  async remove(@CurrentUser() principal: AuthPrincipal, @Param('rtId', ParseUUIDPipe) rtId: string, @Req() request: RequestWithContext): Promise<void> {
    await this.tenantsService.deleteTenant(principal, rtId, { correlationId: request.correlationId });
  }
}
