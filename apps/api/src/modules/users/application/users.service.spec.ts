/**
 * Purpose: Unit tests for user and membership tenant isolation.
 * Caller: Vitest test runner.
 * Deps: UsersService, user repository port, password hasher port.
 * MainFuncs: Verifies tenant-scoped listing, update isolation, role assignment checks, permission assignment checks, and escalation guards.
 * SideEffects: None.
 */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { PasswordHasherPort } from '../../auth/infrastructure/password-hasher.port';
import type { UsersRepositoryPort } from '../infrastructure/users.repository.port';

function createHarness() {
  const repository: UsersRepositoryPort = {
    findUserProfile: vi.fn(async () => ({
      id: 'user-2',
      fullName: 'Warga RT',
      email: 'warga@example.test',
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    })),
    listUserMemberships: vi.fn(async () => []),
    listTenantUsers: vi.fn(async () => ({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    })),
    listTenantMemberships: vi.fn(async () => ({
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    })),
    isUserInTenant: vi.fn(async () => true),
    countAssignableRoles: vi.fn(async (_rtId, roleIds) => roleIds.length),
    countPermissions: vi.fn(async (permissionIds) => permissionIds.length),
    getAssignableRoleKeys: vi.fn(async () => ['BENDAHARA']),
    getAssignableRolePermissionKeys: vi.fn(async () => ['users.read']),
    getPermissionKeys: vi.fn(async () => ['users.read']),
    isTenantRole: vi.fn(async () => true),
    createUserWithMembership: vi.fn(async () => ({
      user: {
        id: 'user-2',
        fullName: 'Warga RT',
        email: 'warga@example.test',
        phone: null,
        status: 'ACTIVE',
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        updatedAt: new Date('2030-01-01T00:00:00.000Z'),
      },
      membership: {
        id: 'membership-2',
        rtId: 'rt-1',
        status: 'ACTIVE',
        roles: [],
      },
    })),
    updateUser: vi.fn(async () => ({
      id: 'user-2',
      fullName: 'Updated Warga',
      email: 'warga@example.test',
      phone: null,
      status: 'ACTIVE',
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      updatedAt: new Date('2030-01-02T00:00:00.000Z'),
    })),
    createMembership: vi.fn(async () => ({
      id: 'membership-2',
      rtId: 'rt-1',
      status: 'ACTIVE',
      roles: [],
    })),
    findMembershipInTenant: vi.fn(async () => ({
      id: 'membership-2',
      rtId: 'rt-1',
      status: 'ACTIVE',
      roles: [],
    })),
    replaceMembershipRoles: vi.fn(async () => ({
      id: 'membership-2',
      rtId: 'rt-1',
      status: 'ACTIVE',
      roles: [{ id: 'role-1', key: 'BENDAHARA', name: 'Bendahara', rtId: 'rt-1', isSystem: false }],
    })),
    disableMembership: vi.fn(async () => ({
      id: 'membership-2',
      rtId: 'rt-1',
      status: 'INACTIVE',
      roles: [],
    })),
    replaceRolePermissions: vi.fn(async () => ({
      id: 'role-1',
      key: 'CUSTOM',
      name: 'Custom',
      rtId: 'rt-1',
      isSystem: false,
      permissions: ['users.read'],
    })),
  };
  const passwordHasher: PasswordHasherPort = {
    hash: vi.fn(async (value: string) => `hashed:${value}`),
    verify: vi.fn(async () => true),
  };
  const principal: AuthPrincipal = {
    userId: 'admin-1',
    membershipId: 'membership-admin',
    rtId: 'rt-1',
    roles: ['KETUA_RT'],
    permissions: ['users.read', 'users.update', 'users.roles.manage'],
  };
  const service = new UsersService(repository, passwordHasher);

  return { repository, passwordHasher, principal, service };
}

describe('UsersService', () => {
  it('lists users only in the current tenant', async () => {
    const { service, repository, principal } = createHarness();

    await service.listTenantUsers(principal, { page: 1, limit: 20 });

    expect(repository.listTenantUsers).toHaveBeenCalledWith('rt-1', { page: 1, limit: 20 });
  });

  it('rejects user updates when the target user is not a current-tenant member', async () => {
    const { service, repository, principal } = createHarness();
    vi.mocked(repository.isUserInTenant).mockResolvedValueOnce(false);

    await expect(
      service.updateUser(principal, 'user-outside', { fullName: 'Outside' }, { correlationId: 'corr-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.updateUser).not.toHaveBeenCalled();
  });

  it('rejects membership role assignment when roles are outside the current tenant', async () => {
    const { service, repository, principal } = createHarness();
    vi.mocked(repository.countAssignableRoles).mockResolvedValueOnce(1);

    await expect(
      service.assignMembershipRoles(principal, 'membership-2', { roleIds: ['role-1', 'role-outside'] }, { correlationId: 'corr-2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replaceMembershipRoles).not.toHaveBeenCalled();
  });

  it('rejects permission assignment for a role outside the current tenant', async () => {
    const { service, repository, principal } = createHarness();
    vi.mocked(repository.isTenantRole).mockResolvedValueOnce(false);

    await expect(
      service.assignRolePermissions(principal, 'role-outside', { permissionIds: ['permission-1'] }, { correlationId: 'corr-3' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('rejects membership role assignment when the actor cannot grant role permissions', async () => {
    const { service, repository, principal } = createHarness();
    vi.mocked(repository.getAssignableRolePermissionKeys).mockResolvedValueOnce(['backup.manage']);

    await expect(
      service.assignMembershipRoles(principal, 'membership-2', { roleIds: ['role-1'] }, { correlationId: 'corr-4' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replaceMembershipRoles).not.toHaveBeenCalled();
  });

  it('rejects role permission assignment when the actor cannot grant requested permissions', async () => {
    const { service, repository, principal } = createHarness();
    vi.mocked(repository.getPermissionKeys).mockResolvedValueOnce(['backup.manage']);

    await expect(
      service.assignRolePermissions(principal, 'role-1', { permissionIds: ['permission-backup'] }, { correlationId: 'corr-5' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('rejects status updates when actor lacks deactivate permission', async () => {
    const { service, repository, principal } = createHarness();

    await expect(
      service.updateUser(principal, 'user-2', { status: 'LOCKED' }, { correlationId: 'corr-status' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateUser).not.toHaveBeenCalled();
  });

  it('rejects SUPER_ADMIN role assignment by non-super-admin actors', async () => {
    const { service, repository, principal } = createHarness();
    vi.mocked(repository.getAssignableRoleKeys).mockResolvedValueOnce(['SUPER_ADMIN']);
    vi.mocked(repository.getAssignableRolePermissionKeys).mockResolvedValueOnce([]);

    await expect(
      service.assignMembershipRoles(principal, 'membership-2', { roleIds: ['role-super'] }, { correlationId: 'corr-super-role' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.replaceMembershipRoles).not.toHaveBeenCalled();
  });
});
