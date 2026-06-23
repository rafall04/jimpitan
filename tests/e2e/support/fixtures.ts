/**
 * Purpose: Deterministic seed and cleanup boundary for E2E tests.
 * Caller: Playwright global setup/teardown and journey specs.
 * Deps: E2E runtime config, Prisma client, bcrypt, RBAC permission constants, and JIMPITAN schema.
 * MainFuncs: Seeds minimal fixtures and cleans all records by run id.
 * SideEffects: Writes and deletes test-owned database rows in the configured E2E database.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { PERMISSION_KEYS } from "../../../apps/api/src/modules/rbac/domain/permission.constants";
import type { E2ERuntimeConfig, E2ESeedFixture } from "../types/e2e.types";

const PASSWORD = "E2ePassword123!";
const prisma = new PrismaClient();

export async function seedMinimalE2EFixtures(config: E2ERuntimeConfig): Promise<E2ESeedFixture> {
  await cleanupE2EFixtures(config);
  await seedPermissions();

  const runId = sanitizeRunId(config.runId);
  const rt = await prisma.rt.create({
    data: {
      code: runId,
      name: `E2E RT ${runId}`,
      address: "E2E test namespace",
    },
  });

  const roles = await seedRoles(rt.id);
  const passwordHash = await bcrypt.hash(PASSWORD, Number(process.env.E2E_BCRYPT_ROUNDS ?? 10));
  const users = await seedUsers(config, passwordHash);
  const memberships = await seedMemberships(rt.id, users, roles);

  const area = await prisma.area.create({
    data: {
      rtId: rt.id,
      code: `BASE-${runId.slice(0, 18)}`,
      name: `Base Area ${runId}`,
      sortOrder: 1,
      createdById: users.bendahara.id,
    },
  });
  const house = await prisma.house.create({
    data: {
      rtId: rt.id,
      areaId: area.id,
      houseNumber: `BASE-${runId.slice(0, 18)}`,
      status: "EMPTY",
      addressNote: "E2E internal address note sentinel",
      createdById: users.bendahara.id,
    },
  });
  const resident = await prisma.resident.create({
    data: {
      rtId: rt.id,
      houseId: house.id,
      fullName: `E2E Private Resident ${runId}`,
      phone: "+6281111111111",
      notes: "E2E internal resident note sentinel",
      defaultJimpitanAmount: "2000",
      createdById: users.bendahara.id,
    },
  });
  await prisma.house.update({ where: { id: house.id }, data: { status: "OCCUPIED" } });

  const cashAccount = await prisma.cashAccount.create({
    data: {
      rtId: rt.id,
      key: `main-${runId.slice(0, 32)}`,
      name: `Kas E2E ${runId}`,
      currency: "IDR",
      createdById: users.bendahara.id,
    },
  });
  const incomeCategory = await prisma.transactionCategory.create({
    data: {
      rtId: rt.id,
      type: "INCOME",
      key: `jimpitan-${runId.slice(0, 30)}`,
      name: "Jimpitan E2E",
      isSystem: true,
      createdById: users.bendahara.id,
    },
  });
  await prisma.transactionCategory.create({
    data: {
      rtId: rt.id,
      type: "EXPENSE",
      key: `expense-${runId.slice(0, 32)}`,
      name: "Expense E2E",
      isSystem: true,
      createdById: users.bendahara.id,
    },
  });

  return {
    runId,
    tenantId: rt.id,
    rtId: rt.id,
    adminUserId: users.superAdmin.id,
    ketuaUserId: users.ketua.id,
    bendaharaUserId: users.bendahara.id,
    officerUserId: users.petugas.id,
    bendaharaMembershipId: memberships.bendahara.id,
    officerMembershipId: memberships.petugas.id,
    areaId: area.id,
    houseId: house.id,
    residentId: resident.id,
    cashAccountId: cashAccount.id,
    incomeCategoryId: incomeCategory.id,
    privateLeakSentinels: ["+6281111111111", "E2E internal resident note sentinel", "E2E internal address note sentinel", "audit logs", "approval internals"],
    publicReportSlug: rt.code,
  };
}

export async function cleanupE2EFixtures(config: E2ERuntimeConfig, fixture?: E2ESeedFixture): Promise<void> {
  const runId = sanitizeRunId(fixture?.runId ?? config.runId);
  const rt = await prisma.rt.findUnique({ where: { code: runId }, select: { id: true } });
  const emails = userEmails(runId, config);
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(emails) } }, select: { id: true } });
  const userIds = users.map((user) => user.id);

  if (rt) {
    const rtId = rt.id;
    // cash_ledgers is append-only via a DB trigger (migration 20260622120000); disable it inside this
    // owner-scoped cleanup transaction so test data can be removed, then re-enable it before commit.
    await prisma.$transaction([
      prisma.$executeRawUnsafe('ALTER TABLE "cash_ledgers" DISABLE TRIGGER USER'),
      prisma.outboxEvent.deleteMany({ where: { rtId } }),
      prisma.notification.deleteMany({ where: { rtId } }),
      prisma.reportExport.deleteMany({ where: { rtId } }),
      prisma.auditLog.deleteMany({ where: { OR: [{ rtId }, { actorUserId: { in: userIds } }] } }),
      prisma.cashLedger.deleteMany({ where: { rtId } }),
      prisma.expenseApproval.deleteMany({ where: { rtId } }),
      prisma.transaction.deleteMany({ where: { rtId } }),
      prisma.collectionItem.deleteMany({ where: { rtId } }),
      prisma.jimpitanCollection.deleteMany({ where: { rtId } }),
      prisma.jimpitanSchedule.deleteMany({ where: { rtId } }),
      prisma.telegramBinding.deleteMany({ where: { rtId } }),
      prisma.resident.deleteMany({ where: { rtId } }),
      prisma.house.deleteMany({ where: { rtId } }),
      prisma.area.deleteMany({ where: { rtId } }),
      prisma.transactionCategory.deleteMany({ where: { rtId } }),
      prisma.cashAccount.deleteMany({ where: { rtId } }),
      prisma.announcement.deleteMany({ where: { rtId } }),
      prisma.setting.deleteMany({ where: { rtId } }),
      prisma.rolePermission.deleteMany({ where: { role: { is: { rtId } } } }),
      prisma.userRole.deleteMany({ where: { membership: { is: { rtId } } } }),
      prisma.rtMembership.deleteMany({ where: { rtId } }),
      prisma.role.deleteMany({ where: { rtId } }),
      prisma.rt.deleteMany({ where: { id: rtId } }),
      prisma.$executeRawUnsafe('ALTER TABLE "cash_ledgers" ENABLE TRIGGER USER'),
    ]);
  }

  if (userIds.length > 0) {
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ]);
  }
}

async function seedPermissions(): Promise<void> {
  for (const key of PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, module: key.split(".")[0], description: key },
      update: { module: key.split(".")[0], description: key },
    });
  }
}

async function seedRoles(rtId: string) {
  const roleInputs = [
    { key: "SUPER_ADMIN", name: "Super Admin", permissions: PERMISSION_KEYS },
    { key: "KETUA_RT", name: "Ketua RT", permissions: PERMISSION_KEYS },
    { key: "BENDAHARA", name: "Bendahara", permissions: PERMISSION_KEYS },
    {
      key: "PETUGAS",
      name: "Petugas",
      permissions: ["collections.read", "collections.update_own", "collections.submit_own", "residents.read", "houses.read", "areas.read"] as const,
    },
  ];
  const roles: Record<string, { id: string }> = {};
  const permissions = await prisma.permission.findMany({ where: { key: { in: [...PERMISSION_KEYS] } }, select: { id: true, key: true } });
  const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission.id]));
  for (const input of roleInputs) {
    const role = await prisma.role.create({
      data: {
        rtId,
        key: input.key,
        name: input.name,
        isSystem: true,
      },
      select: { id: true },
    });
    roles[input.key] = role;
    await prisma.rolePermission.createMany({
      data: input.permissions.map((key) => ({ roleId: role.id, permissionId: permissionByKey.get(key)! })),
    });
  }
  return roles;
}

async function seedUsers(config: E2ERuntimeConfig, passwordHash: string) {
  const emails = userEmails(config.runId, config);
  return {
    superAdmin: await prisma.user.create({ data: { fullName: "E2E Super Admin", email: emails.superAdmin, passwordHash, status: "ACTIVE" } }),
    ketua: await prisma.user.create({ data: { fullName: "E2E Ketua RT", email: emails.ketua, passwordHash, status: "ACTIVE" } }),
    bendahara: await prisma.user.create({ data: { fullName: "E2E Bendahara", email: emails.bendahara, passwordHash, status: "ACTIVE" } }),
    petugas: await prisma.user.create({ data: { fullName: "E2E Petugas", email: emails.petugas, passwordHash, status: "ACTIVE" } }),
  };
}

async function seedMemberships(rtId: string, users: Awaited<ReturnType<typeof seedUsers>>, roles: Record<string, { id: string }>) {
  const superAdmin = await createMembership(rtId, users.superAdmin.id, roles.SUPER_ADMIN.id);
  const ketua = await createMembership(rtId, users.ketua.id, roles.KETUA_RT.id);
  const bendahara = await createMembership(rtId, users.bendahara.id, roles.BENDAHARA.id);
  const petugas = await createMembership(rtId, users.petugas.id, roles.PETUGAS.id);
  return { superAdmin, ketua, bendahara, petugas };
}

async function createMembership(rtId: string, userId: string, roleId: string) {
  const membership = await prisma.rtMembership.create({
    data: { rtId, userId, status: "ACTIVE" },
    select: { id: true },
  });
  await prisma.userRole.create({ data: { membershipId: membership.id, roleId } });
  return membership;
}

function userEmails(runId: string, config?: E2ERuntimeConfig) {
  const suffix = `${runId}@e2e.local`;
  return {
    superAdmin: config?.adminEmail ?? `super-admin.${suffix}`,
    ketua: `ketua.${suffix}`,
    bendahara: config?.bendaharaEmail ?? `bendahara.${suffix}`,
    petugas: `petugas.${suffix}`,
  };
}

function sanitizeRunId(runId: string): string {
  return runId.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32) || "e2e-mvp";
}
