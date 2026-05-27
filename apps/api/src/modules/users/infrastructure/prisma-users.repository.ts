/**
 * Purpose: Prisma persistence adapter for user, membership, role, and permission foundation workflows.
 * Caller: UsersModule dependency injection for UsersService.
 * Deps: PrismaService, Prisma generated enums, user repository port.
 * MainFuncs: Performs tenant-scoped identity queries, membership role updates, permission updates, and audit writes.
 * SideEffects: Reads and writes users, rt_memberships, user_roles, role_permissions, and audit_logs tables.
 */
import { Injectable } from '@nestjs/common';
import { AuditActorType, MembershipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
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
import type { CreateUserResult, MembershipSummary, RoleSummary, RoleWithPermissions, SafeUserProfile, TenantMembershipRow } from '../domain/users.types';
import type { UsersRepositoryPort } from './users.repository.port';

type UserRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type MembershipRow = {
  id: string;
  rtId: string;
  status: string;
  roles: Array<{
    role: RoleSummary;
  }>;
};

type TenantMembershipDbRow = MembershipRow & {
  user: UserRow;
};

type RoleWithPermissionsDbRow = RoleSummary & {
  permissions: Array<{
    permission: {
      key: string;
    };
  }>;
};

@Injectable()
export class PrismaUsersRepository implements UsersRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findUserProfile(userId: string): Promise<SafeUserProfile | null> {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: this.userSelect(),
    });
  }

  async listUserMemberships(userId: string): Promise<MembershipSummary[]> {
    const memberships = await this.prisma.rtMembership.findMany({
      where: {
        userId,
        user: { deletedAt: null },
      },
      orderBy: [{ rtId: 'asc' }, { id: 'asc' }],
      select: this.membershipSelect(),
    });

    return memberships.map((membership) => this.toMembershipSummary(membership));
  }

  async listTenantUsers(rtId: string, pagination: PaginationInput): Promise<PaginatedResult<TenantMembershipRow>> {
    return this.listTenantMembershipRows(rtId, pagination);
  }

  async listTenantMemberships(rtId: string, pagination: PaginationInput): Promise<PaginatedResult<TenantMembershipRow>> {
    return this.listTenantMembershipRows(rtId, pagination);
  }

  async isUserInTenant(userId: string, rtId: string): Promise<boolean> {
    const count = await this.prisma.rtMembership.count({
      where: {
        rtId,
        userId,
        user: { deletedAt: null },
      },
    });

    return count > 0;
  }

  async countAssignableRoles(rtId: string, roleIds: string[]): Promise<number> {
    if (roleIds.length === 0) {
      return 0;
    }

    return this.prisma.role.count({
      where: {
        id: { in: roleIds },
        deletedAt: null,
        OR: [{ rtId }, { rtId: null }],
      },
    });
  }

  async countPermissions(permissionIds: string[]): Promise<number> {
    if (permissionIds.length === 0) {
      return 0;
    }

    return this.prisma.permission.count({
      where: {
        id: { in: permissionIds },
      },
    });
  }

  async getAssignableRoleKeys(rtId: string, roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
        deletedAt: null,
        OR: [{ rtId }, { rtId: null }],
      },
      select: { key: true },
    });

    return roles.map((role) => role.key);
  }

  async getAssignableRolePermissionKeys(rtId: string, roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
        deletedAt: null,
        OR: [{ rtId }, { rtId: null }],
      },
      select: {
        permissions: {
          select: {
            permission: {
              select: { key: true },
            },
          },
        },
      },
    });

    return [
      ...new Set(
        roles.flatMap((role) => role.permissions.map((entry) => entry.permission.key)),
      ),
    ];
  }

  async getPermissionKeys(permissionIds: string[]): Promise<string[]> {
    if (permissionIds.length === 0) {
      return [];
    }

    const permissions = await this.prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
      select: { key: true },
    });

    return permissions.map((permission) => permission.key);
  }

  async isTenantRole(rtId: string, roleId: string): Promise<boolean> {
    const count = await this.prisma.role.count({
      where: {
        id: roleId,
        rtId,
        deletedAt: null,
      },
    });

    return count === 1;
  }

  async createUserWithMembership(input: CreateUserCommand & { rtId: string; passwordHash?: string }, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<CreateUserResult> {
    return this.prisma.$transaction(async (tx) => {
      const existingUser = await this.findExistingUser(tx, input.email, input.phone);
      const user = existingUser ?? await tx.user.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          passwordHash: input.passwordHash,
        },
        select: this.userSelect(),
      });

      if (!existingUser) {
        await this.writeAudit(tx, {
          rtId: input.rtId,
          actor,
          meta,
          action: 'USER_CREATED',
          entityType: 'user',
          entityId: user.id,
          afterData: user,
        });
      }

      let membership = await tx.rtMembership.findFirst({
        where: {
          rtId: input.rtId,
          userId: user.id,
        },
        select: this.membershipSelect(),
      });

      if (!membership) {
        membership = await tx.rtMembership.create({
          data: {
            rtId: input.rtId,
            userId: user.id,
            roles: this.roleCreateInput(input.roleIds),
          },
          select: this.membershipSelect(),
        });
        await this.writeAudit(tx, {
          rtId: input.rtId,
          actor,
          meta,
          action: 'MEMBERSHIP_CREATED',
          entityType: 'rt_membership',
          entityId: membership.id,
          afterData: this.toMembershipSummary(membership),
        });
      }

      return {
        user,
        membership: this.toMembershipSummary(membership),
      };
    });
  }

  async updateUser(userId: string, input: UpdateUserCommand, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<SafeUserProfile | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
        },
        select: this.userSelect(),
      });
      if (!before) {
        return null;
      }

      const after = await tx.user.update({
        where: { id: userId },
        data: input,
        select: this.userSelect(),
      });
      await this.writeAudit(tx, {
        rtId: actor.rtId,
        actor,
        meta,
        action: 'USER_UPDATED',
        entityType: 'user',
        entityId: userId,
        beforeData: before,
        afterData: after,
      });

      return after;
    });
  }

  async createMembership(userId: string, rtId: string, input: CreateMembershipCommand, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<MembershipSummary | null> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: userId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!user) {
        return null;
      }

      const existing = await tx.rtMembership.findFirst({
        where: { userId, rtId },
        select: this.membershipSelect(),
      });
      if (existing) {
        return this.toMembershipSummary(existing);
      }

      const membership = await tx.rtMembership.create({
        data: {
          userId,
          rtId,
          roles: this.roleCreateInput(input.roleIds),
        },
        select: this.membershipSelect(),
      });
      const afterData = this.toMembershipSummary(membership);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'MEMBERSHIP_CREATED',
        entityType: 'rt_membership',
        entityId: membership.id,
        afterData,
      });

      return afterData;
    });
  }

  async findMembershipInTenant(rtId: string, membershipId: string): Promise<MembershipSummary | null> {
    const membership = await this.prisma.rtMembership.findFirst({
      where: {
        id: membershipId,
        rtId,
      },
      select: this.membershipSelect(),
    });

    return membership ? this.toMembershipSummary(membership) : null;
  }

  async replaceMembershipRoles(rtId: string, membershipId: string, input: AssignMembershipRolesCommand, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<MembershipSummary | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.rtMembership.findFirst({
        where: { id: membershipId, rtId },
        select: this.membershipSelect(),
      });
      if (!before) {
        return null;
      }

      await tx.userRole.deleteMany({ where: { membershipId } });
      const uniqueRoleIds = [...new Set(input.roleIds)];
      if (uniqueRoleIds.length > 0) {
        await tx.userRole.createMany({
          data: uniqueRoleIds.map((roleId) => ({ membershipId, roleId })),
        });
      }

      const after = await tx.rtMembership.findFirstOrThrow({
        where: { id: membershipId, rtId },
        select: this.membershipSelect(),
      });
      const beforeData = this.toMembershipSummary(before);
      const afterData = this.toMembershipSummary(after);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'MEMBERSHIP_ROLE_CHANGED',
        entityType: 'rt_membership',
        entityId: membershipId,
        beforeData,
        afterData,
      });

      return afterData;
    });
  }

  async disableMembership(rtId: string, membershipId: string, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<MembershipSummary | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.rtMembership.findFirst({
        where: { id: membershipId, rtId },
        select: this.membershipSelect(),
      });
      if (!before) {
        return null;
      }

      await tx.rtMembership.update({
        where: { id: membershipId },
        data: { status: MembershipStatus.INACTIVE },
      });
      const after = await tx.rtMembership.findFirstOrThrow({
        where: { id: membershipId, rtId },
        select: this.membershipSelect(),
      });
      const beforeData = this.toMembershipSummary(before);
      const afterData = this.toMembershipSummary(after);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'MEMBERSHIP_DISABLED',
        entityType: 'rt_membership',
        entityId: membershipId,
        beforeData,
        afterData,
      });

      return afterData;
    });
  }

  async replaceRolePermissions(rtId: string, roleId: string, input: AssignRolePermissionsCommand, actor: AuthPrincipal, meta: IdentityRequestMeta): Promise<RoleWithPermissions | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.role.findFirst({
        where: { id: roleId, rtId, deletedAt: null },
        select: this.roleWithPermissionsSelect(),
      });
      if (!before) {
        return null;
      }

      await tx.rolePermission.deleteMany({ where: { roleId } });
      const uniquePermissionIds = [...new Set(input.permissionIds)];
      if (uniquePermissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: uniquePermissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }

      const after = await tx.role.findFirstOrThrow({
        where: { id: roleId, rtId, deletedAt: null },
        select: this.roleWithPermissionsSelect(),
      });
      const beforeData = this.toRoleWithPermissions(before);
      const afterData = this.toRoleWithPermissions(after);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'ROLE_PERMISSIONS_CHANGED',
        entityType: 'role',
        entityId: roleId,
        beforeData,
        afterData,
      });

      return afterData;
    });
  }

  private async listTenantMembershipRows(rtId: string, pagination: PaginationInput): Promise<PaginatedResult<TenantMembershipRow>> {
    const where: Prisma.RtMembershipWhereInput = {
      rtId,
      user: { deletedAt: null },
    };
    const [memberships, total] = await this.prisma.$transaction([
      this.prisma.rtMembership.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        select: this.tenantMembershipSelect(),
      }),
      this.prisma.rtMembership.count({ where }),
    ]);

    return {
      items: memberships.map((membership) => this.toTenantMembershipRow(membership)),
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  private async findExistingUser(tx: Prisma.TransactionClient, email?: string, phone?: string): Promise<SafeUserProfile | null> {
    const lookup: Prisma.UserWhereInput[] = [];
    if (email) {
      lookup.push({ email: { equals: email, mode: Prisma.QueryMode.insensitive } });
    }
    if (phone) {
      lookup.push({ phone });
    }
    if (lookup.length === 0) {
      return null;
    }

    return tx.user.findFirst({
      where: {
        deletedAt: null,
        OR: lookup,
      },
      select: this.userSelect(),
    });
  }

  private roleCreateInput(roleIds?: string[]): Prisma.UserRoleCreateNestedManyWithoutMembershipInput | undefined {
    const uniqueRoleIds = [...new Set(roleIds ?? [])];
    if (uniqueRoleIds.length === 0) {
      return undefined;
    }

    return {
      create: uniqueRoleIds.map((roleId) => ({
        role: {
          connect: { id: roleId },
        },
      })),
    };
  }

  private userSelect() {
    return {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.UserSelect;
  }

  private roleSelect() {
    return {
      id: true,
      key: true,
      name: true,
      rtId: true,
      isSystem: true,
    } satisfies Prisma.RoleSelect;
  }

  private membershipSelect() {
    return {
      id: true,
      rtId: true,
      status: true,
      roles: {
        select: {
          role: {
            select: this.roleSelect(),
          },
        },
      },
    } satisfies Prisma.RtMembershipSelect;
  }

  private tenantMembershipSelect() {
    return {
      ...this.membershipSelect(),
      user: {
        select: this.userSelect(),
      },
    } satisfies Prisma.RtMembershipSelect;
  }

  private roleWithPermissionsSelect() {
    return {
      ...this.roleSelect(),
      permissions: {
        select: {
          permission: {
            select: { key: true },
          },
        },
      },
    } satisfies Prisma.RoleSelect;
  }

  private toMembershipSummary(membership: MembershipRow): MembershipSummary {
    return {
      id: membership.id,
      rtId: membership.rtId,
      status: membership.status,
      roles: membership.roles.map((assignment) => assignment.role),
    };
  }

  private toTenantMembershipRow(membership: TenantMembershipDbRow): TenantMembershipRow {
    return {
      ...this.toMembershipSummary(membership),
      user: membership.user,
    };
  }

  private toRoleWithPermissions(role: RoleWithPermissionsDbRow): RoleWithPermissions {
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      rtId: role.rtId,
      isSystem: role.isSystem,
      permissions: role.permissions.map((entry) => entry.permission.key),
    };
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    input: {
      rtId: string;
      actor: AuthPrincipal;
      meta: IdentityRequestMeta;
      action: string;
      entityType: string;
      entityId: string;
      beforeData?: unknown;
      afterData?: unknown;
    },
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        rtId: input.rtId,
        actorUserId: input.actor.userId,
        actorType: AuditActorType.USER,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        requestId: input.meta.correlationId,
        correlationId: input.meta.correlationId,
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
        beforeData: input.beforeData === undefined ? undefined : this.toJson(input.beforeData),
        afterData: input.afterData === undefined ? undefined : this.toJson(input.afterData),
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
