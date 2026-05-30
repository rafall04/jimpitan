/**
 * Purpose: First-admin production bootstrap use case.
 * Caller: Admin bootstrap CLI entrypoint and unit tests.
 * Deps: PrismaService, Auth password hasher port, Prisma enums, and canonical RBAC permission keys.
 * MainFuncs: Creates the initial RT tenant, admin user, SUPER_ADMIN role/membership, permissions, default finance records, and audit log.
 * SideEffects: Writes bootstrap records to PostgreSQL in a serializable transaction and hashes the initial admin password.
 */
import { Inject, Injectable } from '@nestjs/common';
import { AuditActorType, MembershipStatus, Prisma, TransactionType, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PASSWORD_HASHER } from '../modules/auth/auth.tokens';
import type { PasswordHasherPort } from '../modules/auth/infrastructure/password-hasher.port';
import { PERMISSION_KEYS } from '../modules/rbac/domain/permission.constants';
import type { AdminBootstrapInput } from './admin-bootstrap.input';

type BootstrapTransactionClient = {
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  cashAccount: {
    upsert(args: unknown): Promise<unknown>;
  };
  permission: {
    upsert(args: unknown): Promise<{ id: string; key: string }>;
  };
  role: {
    upsert(args: unknown): Promise<{ id: string; key: string }>;
  };
  rolePermission: {
    createMany(args: unknown): Promise<unknown>;
  };
  rt: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    upsert(args: unknown): Promise<{ id: string; code: string; name: string }>;
  };
  rtMembership: {
    upsert(args: unknown): Promise<{ id: string }>;
  };
  transactionCategory: {
    upsert(args: unknown): Promise<unknown>;
  };
  user: {
    findUnique(args: unknown): Promise<BootstrapUser | null>;
    create(args: unknown): Promise<BootstrapUser>;
    update(args: unknown): Promise<unknown>;
  };
  userRole: {
    upsert(args: unknown): Promise<unknown>;
  };
};

type BootstrapPrismaClient = {
  user: {
    count(): Promise<number>;
  };
  $transaction<T>(callback: (tx: BootstrapTransactionClient) => Promise<T>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<T>;
};

type BootstrapUser = {
  id: string;
  email: string | null;
  fullName: string;
  passwordHash: string | null;
};

type BootstrapResult = {
  tenantId: string;
  tenantSlug: string;
  adminUserId: string;
  adminEmail: string;
  createdTenant: boolean;
  createdAdminUser: boolean;
};

const DEFAULT_TRANSACTION_CATEGORIES = [
  { type: TransactionType.INCOME, key: 'jimpitan', name: 'Jimpitan', isSystem: true },
  { type: TransactionType.INCOME, key: 'income-other', name: 'Pemasukan Lainnya', isSystem: true },
  { type: TransactionType.EXPENSE, key: 'expense-operational', name: 'Operasional', isSystem: true },
] as const;

@Injectable()
export class AdminBootstrapService {
  constructor(
    @Inject(PrismaService) private readonly prisma: BootstrapPrismaClient,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
  ) {}

  async execute(input: AdminBootstrapInput): Promise<BootstrapResult> {
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0 && !input.force) {
      throw new AdminBootstrapSafetyError('Bootstrap refused because at least one user already exists. Re-run with --force only if you intentionally need to repair bootstrap records.');
    }

    const passwordHash = await this.passwordHasher.hash(input.adminPassword);
    return this.prisma.$transaction(async (tx) => this.createBootstrapRecords(tx, input, passwordHash), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  }

  private async createBootstrapRecords(tx: BootstrapTransactionClient, input: AdminBootstrapInput, passwordHash: string): Promise<BootstrapResult> {
    const existingTenant = await tx.rt.findUnique({ where: { code: input.tenantSlug }, select: { id: true } });
    const tenant = await tx.rt.upsert({
      where: { code: input.tenantSlug },
      update: {
        isActive: true,
        deletedAt: null,
        deletedById: null,
      },
      create: {
        name: input.tenantName,
        code: input.tenantSlug,
        timezone: 'Asia/Jakarta',
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });

    const existingAdmin = await tx.user.findUnique({
      where: { email: input.adminEmail },
      select: { id: true, email: true, fullName: true, passwordHash: true },
    }) as BootstrapUser | null;
    const admin = existingAdmin ?? await tx.user.create({
      data: {
        fullName: input.adminName,
        email: input.adminEmail,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true, fullName: true, passwordHash: true },
    }) as BootstrapUser;

    if (existingAdmin) {
      await tx.user.update({
        where: { id: existingAdmin.id },
        data: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          deletedById: null,
          ...(existingAdmin.passwordHash ? {} : { passwordHash }),
        },
      });
    }

    const role = await tx.role.upsert({
      where: { rtId_key: { rtId: tenant.id, key: 'SUPER_ADMIN' } },
      update: { isSystem: true, deletedAt: null, deletedById: null, updatedById: admin.id },
      create: {
        rtId: tenant.id,
        key: 'SUPER_ADMIN',
        name: 'Super Admin',
        description: 'Full tenant administration role created by first-admin bootstrap.',
        isSystem: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
      select: { id: true, key: true },
    });

    const membership = await tx.rtMembership.upsert({
      where: { rtId_userId: { rtId: tenant.id, userId: admin.id } },
      update: { status: MembershipStatus.ACTIVE },
      create: {
        rtId: tenant.id,
        userId: admin.id,
        status: MembershipStatus.ACTIVE,
      },
      select: { id: true },
    });

    await tx.userRole.upsert({
      where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
      update: {},
      create: {
        membershipId: membership.id,
        roleId: role.id,
      },
    });

    const permissions = await Promise.all(PERMISSION_KEYS.map((key) => tx.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        module: key.split('.')[0],
        description: `Allows ${key}.`,
      },
      select: { id: true, key: true },
    })));
    await tx.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });

    await this.ensureFinanceDefaults(tx, tenant.id, admin.id);
    await this.writeAudit(tx, {
      tenantId: tenant.id,
      tenantSlug: tenant.code,
      adminUserId: admin.id,
      adminEmail: input.adminEmail,
      createdTenant: !existingTenant,
      createdAdminUser: !existingAdmin,
    });

    return {
      tenantId: tenant.id,
      tenantSlug: tenant.code,
      adminUserId: admin.id,
      adminEmail: input.adminEmail,
      createdTenant: !existingTenant,
      createdAdminUser: !existingAdmin,
    };
  }

  private async ensureFinanceDefaults(tx: BootstrapTransactionClient, rtId: string, adminUserId: string): Promise<void> {
    await tx.cashAccount.upsert({
      where: { rtId_key: { rtId, key: 'main' } },
      update: { isActive: true, deletedAt: null, deletedById: null, updatedById: adminUserId },
      create: {
        rtId,
        key: 'main',
        name: 'Kas Utama',
        currency: 'IDR',
        createdById: adminUserId,
        updatedById: adminUserId,
      },
    });

    for (const category of DEFAULT_TRANSACTION_CATEGORIES) {
      await tx.transactionCategory.upsert({
        where: { rtId_key_type: { rtId, key: category.key, type: category.type } },
        update: { isActive: true, deletedAt: null, deletedById: null, updatedById: adminUserId },
        create: {
          rtId,
          type: category.type,
          key: category.key,
          name: category.name,
          isSystem: category.isSystem,
          createdById: adminUserId,
          updatedById: adminUserId,
        },
      });
    }
  }

  private async writeAudit(tx: BootstrapTransactionClient, result: BootstrapResult): Promise<void> {
    await tx.auditLog.create({
      data: {
        rtId: result.tenantId,
        actorType: AuditActorType.SYSTEM,
        action: 'FIRST_ADMIN_BOOTSTRAPPED',
        entityType: 'rt',
        entityId: result.tenantId,
        requestId: 'bootstrap:admin',
        correlationId: 'bootstrap:admin',
        afterData: this.toJson({
          tenantId: result.tenantId,
          tenantSlug: result.tenantSlug,
          adminUserId: result.adminUserId,
          adminEmail: result.adminEmail,
          createdTenant: result.createdTenant,
          createdAdminUser: result.createdAdminUser,
        }),
      },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}

export class AdminBootstrapSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminBootstrapSafetyError';
  }
}
