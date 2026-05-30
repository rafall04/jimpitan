/**
 * Purpose: Unit tests for first-admin production bootstrap safety.
 * Caller: Vitest API test suite.
 * Deps: AdminBootstrapService, bootstrap input parser, fake Prisma transaction client, and fake password hasher.
 * MainFuncs: Verifies first-run refusal, secure input validation, tenant/admin/role/finance creation, and password hashing boundaries.
 * SideEffects: None.
 */
import { AuditActorType, MembershipStatus, TransactionType, UserStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSION_KEYS } from '../modules/rbac/domain/permission.constants';
import { AdminBootstrapSafetyError, AdminBootstrapService } from './admin-bootstrap.service';
import { parseAdminBootstrapInput } from './admin-bootstrap.input';

describe('parseAdminBootstrapInput', () => {
  it('reads required values from env and rejects weak passwords', () => {
    expect(() => parseAdminBootstrapInput([], {
      ADMIN_EMAIL: 'root@example.com',
      ADMIN_PASSWORD: 'weak',
      ADMIN_NAME: 'Root Admin',
      TENANT_NAME: 'RT 001',
      TENANT_SLUG: 'rt001',
    })).toThrow('ADMIN_PASSWORD');
  });

  it('lets CLI args override env values without printing secrets', () => {
    const input = parseAdminBootstrapInput([
      '--admin-email', 'owner@example.com',
      '--admin-password', 'StrongerPass123!',
      '--admin-name', 'Owner',
      '--tenant-name', 'RT Owner',
      '--tenant-slug', 'rt-owner',
      '--force',
    ], {
      ADMIN_EMAIL: 'env@example.com',
      ADMIN_PASSWORD: 'EnvPass123!',
      ADMIN_NAME: 'Env Owner',
      TENANT_NAME: 'Env RT',
      TENANT_SLUG: 'env-rt',
    });

    expect(input).toMatchObject({
      adminEmail: 'owner@example.com',
      adminPassword: 'StrongerPass123!',
      adminName: 'Owner',
      tenantName: 'RT Owner',
      tenantSlug: 'rt-owner',
      force: true,
    });
  });
});

describe('AdminBootstrapService', () => {
  it('refuses to run when any user exists unless force is explicit', async () => {
    const prisma = createPrismaHarness({ existingUserCount: 1 });
    const hasher = { hash: vi.fn(async () => 'hashed-password'), verify: vi.fn() };
    const service = new AdminBootstrapService(prisma.client as unknown as ConstructorParameters<typeof AdminBootstrapService>[0], hasher);

    await expect(service.execute(validInput({ force: false }))).rejects.toBeInstanceOf(AdminBootstrapSafetyError);
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(prisma.tx.rt.upsert).not.toHaveBeenCalled();
  });

  it('creates first tenant, admin, super-admin role, membership, permissions, finance defaults, and audit log', async () => {
    const prisma = createPrismaHarness({ existingUserCount: 0 });
    const hasher = { hash: vi.fn(async () => 'hashed-password'), verify: vi.fn() };
    const service = new AdminBootstrapService(prisma.client as unknown as ConstructorParameters<typeof AdminBootstrapService>[0], hasher);

    const result = await service.execute(validInput());

    expect(result).toEqual({
      tenantId: 'rt-1',
      tenantSlug: 'rt001',
      adminUserId: 'user-1',
      adminEmail: 'root@example.com',
      createdTenant: true,
      createdAdminUser: true,
    });
    expect(hasher.hash).toHaveBeenCalledWith('RootPass123!');
    expect(prisma.tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'root@example.com',
        fullName: 'Root Admin',
        passwordHash: 'hashed-password',
        status: UserStatus.ACTIVE,
      }),
    }));
    expect(prisma.tx.role.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ key: 'SUPER_ADMIN', isSystem: true }),
    }));
    expect(prisma.tx.rtMembership.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ rtId: 'rt-1', userId: 'user-1', status: MembershipStatus.ACTIVE }),
    }));
    expect(prisma.tx.rolePermission.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        { roleId: 'role-super-admin', permissionId: 'permission-auth-session-manage' },
      ]),
      skipDuplicates: true,
    }));
    expect(prisma.tx.cashAccount.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ rtId: 'rt-1', key: 'main', name: 'Kas Utama', currency: 'IDR' }),
    }));
    expect(prisma.tx.transactionCategory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ rtId: 'rt-1', key: 'jimpitan', type: TransactionType.INCOME, isSystem: true }),
    }));
    expect(prisma.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorType: AuditActorType.SYSTEM,
        action: 'FIRST_ADMIN_BOOTSTRAPPED',
        entityType: 'rt',
        entityId: 'rt-1',
      }),
    }));
    expect(JSON.stringify(prisma.tx.auditLog.create.mock.calls)).not.toContain('RootPass123!');
    expect(JSON.stringify(prisma.tx.auditLog.create.mock.calls)).not.toContain('hashed-password');
  });
});

function validInput(overrides: Partial<ReturnType<typeof parseAdminBootstrapInput>> = {}) {
  return {
    adminEmail: 'root@example.com',
    adminPassword: 'RootPass123!',
    adminName: 'Root Admin',
    tenantName: 'RT 001',
    tenantSlug: 'rt001',
    force: false,
    ...overrides,
  };
}

function createPrismaHarness({ existingUserCount }: { existingUserCount: number }) {
  const permissions = PERMISSION_KEYS.map((key) => ({
    id: `permission-${key.replace(/\./g, '-')}`,
    key,
  }));
  const tx = {
    rt: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({ id: 'rt-1', code: 'rt001', name: 'RT 001' })),
    },
    user: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'user-1', email: 'root@example.com', fullName: 'Root Admin', passwordHash: 'hashed-password' })),
      update: vi.fn(),
    },
    role: {
      upsert: vi.fn(async () => ({ id: 'role-super-admin', key: 'SUPER_ADMIN' })),
    },
    rtMembership: {
      upsert: vi.fn(async () => ({ id: 'membership-1' })),
    },
    userRole: {
      upsert: vi.fn(async () => ({ membershipId: 'membership-1', roleId: 'role-super-admin' })),
    },
    permission: {
      upsert: vi.fn(async ({ where }: { where: { key: string } }) => permissions.find((permission) => permission.key === where.key) ?? { id: `permission-${where.key}`, key: where.key }),
    },
    rolePermission: {
      createMany: vi.fn(async () => ({ count: permissions.length })),
    },
    cashAccount: {
      upsert: vi.fn(async () => ({ id: 'cash-main' })),
    },
    transactionCategory: {
      upsert: vi.fn(async () => ({ id: 'category-jimpitan' })),
    },
    auditLog: {
      create: vi.fn(async () => ({ id: 'audit-1' })),
    },
  };

  return {
    tx,
    client: {
      user: {
        count: vi.fn(async () => existingUserCount),
      },
      $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    },
  };
}
