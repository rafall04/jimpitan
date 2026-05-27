/**
 * Purpose: Application service for user, membership, role, and permission foundation use cases.
 * Caller: UsersController and unit tests.
 * Deps: Users repository port, password hasher port, AuthPrincipal, pagination types.
 * MainFuncs: Enforces tenant isolation and validates role/permission assignment boundaries.
 * SideEffects: Writes identity data and audit logs through the repository port.
 */
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PaginationInput, PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { PASSWORD_HASHER } from '../../auth/auth.tokens';
import type { PasswordHasherPort } from '../../auth/infrastructure/password-hasher.port';
import { USERS_REPOSITORY } from '../users.tokens';
import type {
  AssignMembershipRolesCommand,
  AssignRolePermissionsCommand,
  CreateMembershipCommand,
  CreateUserCommand,
  IdentityRequestMeta,
  UpdateUserCommand,
} from './users.commands';
import type { CreateUserResult, MembershipSummary, RoleWithPermissions, SafeUserProfile, TenantMembershipRow } from '../domain/users.types';
import type { UsersRepositoryPort } from '../infrastructure/users.repository.port';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepositoryPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async getMyProfile(actor: AuthPrincipal): Promise<SafeUserProfile> {
    const profile = await this.usersRepository.findUserProfile(actor.userId);
    if (!profile) {
      throw new NotFoundException('User profile was not found.');
    }
    return profile;
  }

  async listMyMemberships(actor: AuthPrincipal): Promise<MembershipSummary[]> {
    return this.usersRepository.listUserMemberships(actor.userId);
  }

  async listTenantUsers(actor: AuthPrincipal, pagination: PaginationInput): Promise<PaginatedResult<TenantMembershipRow>> {
    return this.usersRepository.listTenantUsers(actor.rtId, pagination);
  }

  async listTenantMemberships(actor: AuthPrincipal, pagination: PaginationInput): Promise<PaginatedResult<TenantMembershipRow>> {
    return this.usersRepository.listTenantMemberships(actor.rtId, pagination);
  }

  async createUser(actor: AuthPrincipal, command: CreateUserCommand, meta: IdentityRequestMeta): Promise<CreateUserResult> {
    await this.assertAssignableRoles(actor.rtId, command.roleIds ?? []);
    await this.assertActorCanAssignRoles(actor, command.roleIds ?? []);
    const passwordHash = command.initialPassword ? await this.passwordHasher.hash(command.initialPassword) : undefined;
    return this.usersRepository.createUserWithMembership(
      {
        ...command,
        rtId: actor.rtId,
        passwordHash,
      },
      actor,
      meta,
    );
  }

  async updateUser(actor: AuthPrincipal, userId: string, command: UpdateUserCommand, meta: IdentityRequestMeta): Promise<SafeUserProfile> {
    this.assertActorCanChangeUserStatus(actor, command);
    await this.assertUserInTenant(userId, actor.rtId);
    const user = await this.usersRepository.updateUser(userId, command, actor, meta);
    if (!user) {
      throw new NotFoundException('User was not found.');
    }
    return user;
  }

  async createMembership(actor: AuthPrincipal, userId: string, command: CreateMembershipCommand, meta: IdentityRequestMeta): Promise<MembershipSummary> {
    await this.assertAssignableRoles(actor.rtId, command.roleIds ?? []);
    await this.assertActorCanAssignRoles(actor, command.roleIds ?? []);
    const membership = await this.usersRepository.createMembership(userId, actor.rtId, command, actor, meta);
    if (!membership) {
      throw new NotFoundException('User was not found.');
    }
    return membership;
  }

  async assignMembershipRoles(actor: AuthPrincipal, membershipId: string, command: AssignMembershipRolesCommand, meta: IdentityRequestMeta): Promise<MembershipSummary> {
    await this.assertMembershipInTenant(actor.rtId, membershipId);
    await this.assertAssignableRoles(actor.rtId, command.roleIds);
    await this.assertActorCanAssignRoles(actor, command.roleIds);
    const membership = await this.usersRepository.replaceMembershipRoles(actor.rtId, membershipId, command, actor, meta);
    if (!membership) {
      throw new NotFoundException('Membership was not found.');
    }
    return membership;
  }

  async disableMembership(actor: AuthPrincipal, membershipId: string, meta: IdentityRequestMeta): Promise<MembershipSummary> {
    await this.assertMembershipInTenant(actor.rtId, membershipId);
    const membership = await this.usersRepository.disableMembership(actor.rtId, membershipId, actor, meta);
    if (!membership) {
      throw new NotFoundException('Membership was not found.');
    }
    return membership;
  }

  async assignRolePermissions(actor: AuthPrincipal, roleId: string, command: AssignRolePermissionsCommand, meta: IdentityRequestMeta): Promise<RoleWithPermissions> {
    const isTenantRole = await this.usersRepository.isTenantRole(actor.rtId, roleId);
    if (!isTenantRole) {
      throw new NotFoundException('Role was not found.');
    }
    await this.assertPermissionsExist(command.permissionIds);
    await this.assertActorCanGrantPermissionIds(actor, command.permissionIds);
    const role = await this.usersRepository.replaceRolePermissions(actor.rtId, roleId, command, actor, meta);
    if (!role) {
      throw new NotFoundException('Role was not found.');
    }
    return role;
  }

  private async assertUserInTenant(userId: string, rtId: string): Promise<void> {
    const exists = await this.usersRepository.isUserInTenant(userId, rtId);
    if (!exists) {
      throw new NotFoundException('User was not found.');
    }
  }

  private async assertMembershipInTenant(rtId: string, membershipId: string): Promise<void> {
    const membership = await this.usersRepository.findMembershipInTenant(rtId, membershipId);
    if (!membership) {
      throw new NotFoundException('Membership was not found.');
    }
  }

  private async assertAssignableRoles(rtId: string, roleIds: string[]): Promise<void> {
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0) {
      return;
    }

    const count = await this.usersRepository.countAssignableRoles(rtId, uniqueRoleIds);
    if (count !== uniqueRoleIds.length) {
      throw new BadRequestException('One or more roles are not assignable in this tenant.');
    }
  }

  private async assertPermissionsExist(permissionIds: string[]): Promise<void> {
    const uniquePermissionIds = [...new Set(permissionIds)];
    if (uniquePermissionIds.length === 0) {
      return;
    }

    const count = await this.usersRepository.countPermissions(uniquePermissionIds);
    if (count !== uniquePermissionIds.length) {
      throw new BadRequestException('One or more permissions do not exist.');
    }
  }

  private async assertActorCanAssignRoles(actor: AuthPrincipal, roleIds: string[]): Promise<void> {
    const uniqueRoleIds = [...new Set(roleIds)];
    if (uniqueRoleIds.length === 0 || this.isSuperAdmin(actor)) {
      return;
    }

    const roleKeys = await this.usersRepository.getAssignableRoleKeys(actor.rtId, uniqueRoleIds);
    if (roleKeys.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Super-admin roles can only be assigned by a super-admin.');
    }

    const permissionKeys = await this.usersRepository.getAssignableRolePermissionKeys(actor.rtId, uniqueRoleIds);
    this.assertActorCanGrantPermissionKeys(actor, permissionKeys);
  }

  private async assertActorCanGrantPermissionIds(actor: AuthPrincipal, permissionIds: string[]): Promise<void> {
    const uniquePermissionIds = [...new Set(permissionIds)];
    if (uniquePermissionIds.length === 0 || this.isSuperAdmin(actor)) {
      return;
    }

    const permissionKeys = await this.usersRepository.getPermissionKeys(uniquePermissionIds);
    this.assertActorCanGrantPermissionKeys(actor, permissionKeys);
  }

  private assertActorCanGrantPermissionKeys(actor: AuthPrincipal, permissionKeys: string[]): void {
    const actorPermissionSet = new Set(actor.permissions);
    const canGrantAll = permissionKeys.every((permissionKey) => actorPermissionSet.has(permissionKey));
    if (!canGrantAll) {
      throw new BadRequestException('Cannot grant permissions outside the actor permission set.');
    }
  }

  private assertActorCanChangeUserStatus(actor: AuthPrincipal, command: UpdateUserCommand): void {
    if (!command.status || this.isSuperAdmin(actor) || actor.permissions.includes('users.deactivate')) {
      return;
    }

    throw new ForbiddenException('User status changes require deactivate permission.');
  }

  private isSuperAdmin(actor: AuthPrincipal): boolean {
    return actor.roles.includes('SUPER_ADMIN');
  }
}
