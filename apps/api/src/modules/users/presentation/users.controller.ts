/**
 * Purpose: HTTP controller for user, membership, role, and permission foundation endpoints.
 * Caller: NestJS router.
 * Deps: UsersService, Auth/RBAC guards, user DTOs, pagination DTO.
 * MainFuncs: Exposes safe profile, membership listing, tenant-scoped user management, role assignment, and permission assignment.
 * SideEffects: Writes identity and audit data through UsersService on mutating routes.
 */
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { isIP } from 'net';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/permissions.decorator';import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import type { RequestWithContext } from '../../../common/types/request-context.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { UsersService } from '../application/users.service';
import { AssignMembershipRolesDto } from './dto/assign-membership-roles.dto';
import { AssignRolePermissionsDto } from './dto/assign-role-permissions.dto';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async myProfile(@CurrentUser() principal: AuthPrincipal) {
    return this.usersService.getMyProfile(principal);
  }

  @Get('me/memberships')
  async myMemberships(@CurrentUser() principal: AuthPrincipal) {
    return this.usersService.listMyMemberships(principal);
  }

  @RequireAnyPermission('users.read')
  @Get()
  async listUsers(@CurrentUser() principal: AuthPrincipal, @Query() query: PaginationQueryDto) {
    return this.usersService.listTenantUsers(principal, query);
  }

  @RequireAnyPermission('users.read')
  @Get('memberships')
  async listMemberships(@CurrentUser() principal: AuthPrincipal, @Query() query: PaginationQueryDto) {
    return this.usersService.listTenantMemberships(principal, query);
  }

  @RequireAnyPermission('users.create')
  @Post()
  async createUser(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateUserDto, @Req() request: RequestWithContext) {
    return this.usersService.createUser(principal, dto, this.requestMeta(request));
  }

  @RequireAnyPermission('roles.manage')
  @Put('roles/:roleId/permissions')
  async assignRolePermissions(
    @CurrentUser() principal: AuthPrincipal,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignRolePermissionsDto,
    @Req() request: RequestWithContext,
  ) {
    return this.usersService.assignRolePermissions(principal, roleId, dto, this.requestMeta(request));
  }

  @RequireAnyPermission('users.roles.manage')
  @Put('memberships/:membershipId/roles')
  async assignMembershipRoles(
    @CurrentUser() principal: AuthPrincipal,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: AssignMembershipRolesDto,
    @Req() request: RequestWithContext,
  ) {
    return this.usersService.assignMembershipRoles(principal, membershipId, dto, this.requestMeta(request));
  }

  @RequireAnyPermission('users.deactivate')
  @Patch('memberships/:membershipId/disable')
  async disableMembership(
    @CurrentUser() principal: AuthPrincipal,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Req() request: RequestWithContext,
  ) {
    return this.usersService.disableMembership(principal, membershipId, this.requestMeta(request));
  }

  @RequireAnyPermission('users.roles.manage')
  @Post(':userId/memberships')
  async createMembership(
    @CurrentUser() principal: AuthPrincipal,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateMembershipDto,
    @Req() request: RequestWithContext,
  ) {
    return this.usersService.createMembership(principal, userId, dto, this.requestMeta(request));
  }

  @RequireAnyPermission('users.update')
  @Patch(':userId')
  async updateUser(
    @CurrentUser() principal: AuthPrincipal,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
    @Req() request: RequestWithContext,
  ) {
    return this.usersService.updateUser(principal, userId, dto, this.requestMeta(request));
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
