/**
 * Purpose: HTTP controller for tenant-scoped resident endpoints.
 * Caller: NestJS router.
 * Deps: ResidentsService, Auth/RBAC guards, resident DTOs, and request context type.
 * MainFuncs: Exposes resident list, detail, create, update, archive, reactivate, and house-move routes with RBAC metadata.
 * SideEffects: Writes resident data through ResidentsService on mutating routes.
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
import { ResidentsService } from '../application/residents.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { MoveResidentDto } from './dto/move-resident.dto';
import { ResidentQueryDto } from './dto/resident-query.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';

@ApiTags('residents')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, TenantGuard, PermissionGuard)
@Controller({ path: 'residents', version: '1' })
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @ApiOperation({ summary: 'List RT residents' })
  @RequireAnyPermission('residents.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: ResidentQueryDto) {
    return this.residentsService.listResidents(principal, query);
  }

  @ApiOperation({ summary: 'Create RT resident' })
  @RequireAnyPermission('residents.create')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateResidentDto, @Req() request: RequestWithContext) {
    return this.residentsService.createResident(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get RT resident detail' })
  @RequireAnyPermission('residents.read')
  @Get(':residentId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('residentId', ParseUUIDPipe) residentId: string) {
    return this.residentsService.getResident(principal, residentId);
  }

  @ApiOperation({ summary: 'Update RT resident' })
  @RequireAnyPermission('residents.update')
  @Patch(':residentId')
  async update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Body() dto: UpdateResidentDto,
    @Req() request: RequestWithContext,
  ) {
    return this.residentsService.updateResident(principal, residentId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Move RT resident to another house' })
  @RequireAnyPermission('residents.update')
  @Patch(':residentId/house')
  async moveHouse(
    @CurrentUser() principal: AuthPrincipal,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Body() dto: MoveResidentDto,
    @Req() request: RequestWithContext,
  ) {
    return this.residentsService.moveResident(principal, residentId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Archive RT resident' })
  @RequireAnyPermission('residents.delete')
  @Patch(':residentId/archive')
  async archive(@CurrentUser() principal: AuthPrincipal, @Param('residentId', ParseUUIDPipe) residentId: string, @Req() request: RequestWithContext) {
    return this.residentsService.archiveResident(principal, residentId, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Reactivate RT resident' })
  @RequireAnyPermission('residents.update')
  @Patch(':residentId/reactivate')
  async reactivate(@CurrentUser() principal: AuthPrincipal, @Param('residentId', ParseUUIDPipe) residentId: string, @Req() request: RequestWithContext) {
    return this.residentsService.reactivateResident(principal, residentId, this.requestMeta(request));
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
