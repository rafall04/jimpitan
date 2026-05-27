/**
 * Purpose: HTTP controller for tenant-scoped RT area endpoints.
 * Caller: NestJS router.
 * Deps: AreasService, Auth/RBAC guards, area DTOs, and request context type.
 * MainFuncs: Exposes area list, detail, create, update, and archive routes with RBAC metadata.
 * SideEffects: Writes area data through AreasService on mutating routes.
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
import { AreasService } from '../application/areas.service';
import { AreaQueryDto } from './dto/area-query.dto';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@ApiTags('areas')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, TenantGuard, PermissionGuard)
@Controller({ path: 'areas', version: '1' })
export class AreasController {
  constructor(private readonly areasService: AreasService) {}

  @ApiOperation({ summary: 'List RT areas' })
  @RequireAnyPermission('areas.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: AreaQueryDto) {
    return this.areasService.listAreas(principal, query);
  }

  @ApiOperation({ summary: 'Create RT area' })
  @RequireAnyPermission('areas.manage')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateAreaDto, @Req() request: RequestWithContext) {
    return this.areasService.createArea(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get RT area detail' })
  @RequireAnyPermission('areas.read')
  @Get(':areaId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('areaId', ParseUUIDPipe) areaId: string) {
    return this.areasService.getArea(principal, areaId);
  }

  @ApiOperation({ summary: 'Update RT area' })
  @RequireAnyPermission('areas.manage')
  @Patch(':areaId')
  async update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('areaId', ParseUUIDPipe) areaId: string,
    @Body() dto: UpdateAreaDto,
    @Req() request: RequestWithContext,
  ) {
    return this.areasService.updateArea(principal, areaId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Archive RT area' })
  @RequireAnyPermission('areas.manage')
  @Patch(':areaId/archive')
  async archive(@CurrentUser() principal: AuthPrincipal, @Param('areaId', ParseUUIDPipe) areaId: string, @Req() request: RequestWithContext) {
    return this.areasService.archiveArea(principal, areaId, this.requestMeta(request));
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
