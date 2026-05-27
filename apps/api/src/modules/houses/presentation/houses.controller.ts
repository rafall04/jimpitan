/**
 * Purpose: HTTP controller for tenant-scoped RT house endpoints.
 * Caller: NestJS router.
 * Deps: HousesService, Auth/RBAC guards, house DTOs, and request context type.
 * MainFuncs: Exposes house list, detail, create, update, and archive routes with RBAC metadata.
 * SideEffects: Writes house data through HousesService on mutating routes.
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
import { HousesService } from '../application/houses.service';
import { CreateHouseDto } from './dto/create-house.dto';
import { HouseQueryDto } from './dto/house-query.dto';
import { UpdateHouseDto } from './dto/update-house.dto';

@ApiTags('houses')
@ApiBearerAuth()
@UseGuards(AuthenticationGuard, TenantGuard, PermissionGuard)
@Controller({ path: 'houses', version: '1' })
export class HousesController {
  constructor(private readonly housesService: HousesService) {}

  @ApiOperation({ summary: 'List RT houses' })
  @RequireAnyPermission('houses.read')
  @Get()
  async list(@CurrentUser() principal: AuthPrincipal, @Query() query: HouseQueryDto) {
    return this.housesService.listHouses(principal, query);
  }

  @ApiOperation({ summary: 'Create RT house' })
  @RequireAnyPermission('houses.manage')
  @Post()
  async create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateHouseDto, @Req() request: RequestWithContext) {
    return this.housesService.createHouse(principal, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Get RT house detail' })
  @RequireAnyPermission('houses.read')
  @Get(':houseId')
  async get(@CurrentUser() principal: AuthPrincipal, @Param('houseId', ParseUUIDPipe) houseId: string) {
    return this.housesService.getHouse(principal, houseId);
  }

  @ApiOperation({ summary: 'Update RT house' })
  @RequireAnyPermission('houses.manage')
  @Patch(':houseId')
  async update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('houseId', ParseUUIDPipe) houseId: string,
    @Body() dto: UpdateHouseDto,
    @Req() request: RequestWithContext,
  ) {
    return this.housesService.updateHouse(principal, houseId, dto, this.requestMeta(request));
  }

  @ApiOperation({ summary: 'Archive RT house' })
  @RequireAnyPermission('houses.manage')
  @Patch(':houseId/archive')
  async archive(@CurrentUser() principal: AuthPrincipal, @Param('houseId', ParseUUIDPipe) houseId: string, @Req() request: RequestWithContext) {
    return this.housesService.archiveHouse(principal, houseId, this.requestMeta(request));
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
