/**
 * Purpose: Repository contract for user, membership, role, and permission persistence operations.
 * Caller: UsersService.
 * Deps: Pagination, AuthPrincipal, user domain types, and command types.
 * MainFuncs: Defines identity persistence boundaries without exposing Prisma to the application layer.
 * SideEffects: None.
 */
import type { PaginatedResult, PaginationInput } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type {
  AssignMembershipRolesCommand,
  AssignRolePermissionsCommand,
  CreateMembershipCommand,
  CreateUserCommand,
  IdentityRequestMeta,
  UpdateUserCommand,
} from '../application/users.commands';
import type { CreateUserResult, MembershipSummary, RoleWithPermissions, SafeUserProfile, TenantMembershipRow } from '../domain/users.types';

export interface UsersRepositoryPort {
  findUserProfile(userId: string): Promise<SafeUserProfile | null>;
  listUserMemberships(userId: string): Promise<MembershipSummary[]>;
  listTenantUsers(rtId: string, pagination: PaginationInput): Promise<PaginatedResult<TenantMembershipRow>>;
  listTenantMemberships(rtId: string, pagination: PaginationInput): Promise<PaginatedResult<TenantMembershipRow>>;
  isUserInTenant(userId: string, rtId: string): Promise<boolean>;
  countAssignableRoles(rtId: string, roleIds: string[]): Promise<number>;
  countPermissions(permissionIds: string[]): Promise<number>;
  getAssignableRoleKeys(rtId: string, roleIds: string[]): Promise<string[]>;
  getAssignableRolePermissionKeys(rtId: string, roleIds: string[]): Promise<string[]>;
  getPermissionKeys(permissionIds: string[]): Promise<string[]>;
  isTenantRole(rtId: string, roleId: string): Promise<boolean>;
  createUserWithMembership(input: CreateUserCommand & { rtId: string; passwordHash?: string }, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<CreateUserResult>;
  updateUser(userId: string, input: UpdateUserCommand, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<SafeUserProfile | null>;
  createMembership(userId: string, rtId: string, input: CreateMembershipCommand, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<MembershipSummary | null>;
  findMembershipInTenant(rtId: string, membershipId: string): Promise<MembershipSummary | null>;
  replaceMembershipRoles(rtId: string, membershipId: string, input: AssignMembershipRolesCommand, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<MembershipSummary | null>;
  disableMembership(rtId: string, membershipId: string, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<MembershipSummary | null>;
  replaceRolePermissions(rtId: string, roleId: string, input: AssignRolePermissionsCommand, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<RoleWithPermissions | null>;
}
