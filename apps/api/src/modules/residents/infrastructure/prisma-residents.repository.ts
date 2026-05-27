/**
 * Purpose: Prisma persistence adapter for tenant-scoped resident management.
 * Caller: ResidentsModule dependency injection for ResidentsService.
 * Deps: PrismaService, Prisma enums/types, and resident repository port.
 * MainFuncs: Performs scoped resident CRUD, filtered listing, house assignment, Telegram binding, occupancy sync, and audit writes.
 * SideEffects: Reads and writes residents, houses, telegram_bindings, and audit_logs table rows.
 */
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuditActorType, HouseStatus, Prisma, ResidentStatus, TelegramBindingStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { CreateResidentCommand, MoveResidentCommand, ResidentListQuery, ResidentRequestMeta, UpdateResidentCommand } from '../application/residents.commands';
import type { AssignableHouseRecord, ResidentListRow, ResidentRecord, TelegramAccountRecord, TelegramBindingConflict } from '../domain/residents.types';
import type { ResidentsRepositoryPort } from './residents.repository.port';

type ResidentDbRow = {
  id: string;
  rtId: string;
  houseId: string;
  fullName: string;
  phone: string | null;
  status: ResidentStatus;
  defaultJimpitanAmount: Prisma.Decimal;
  notes?: string | null;
  telegramBindings: Array<{
    telegramAccountId: string;
  }>;
  house: {
    id: string;
    houseNumber: string;
    status: HouseStatus;
    area: {
      id: string;
      code: string;
      name: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
};

type HouseOccupancyRow = {
  id: string;
  status: HouseStatus;
  houseNumber: string;
};

@Injectable()
export class PrismaResidentsRepository implements ResidentsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listResidents(rtId: string, query: ResidentListQuery): Promise<PaginatedResult<ResidentListRow>> {
    const where = this.residentWhere(rtId, query);
    const [residents, total] = await this.prisma.$transaction([
      this.prisma.resident.findMany({
        where,
        select: this.residentListSelect(),
        orderBy: this.residentOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.resident.count({ where }),
    ]);

    return {
      items: residents.map((resident) => this.toResidentListRow(resident)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findResidentById(rtId: string, residentId: string, options?: { includeArchived?: boolean }): Promise<ResidentRecord | null> {
    const resident = await this.prisma.resident.findFirst({
      where: {
        id: residentId,
        rtId,
        ...(options?.includeArchived ? {} : { deletedAt: null }),
      },
      select: this.residentDetailSelect(),
    });

    return resident ? this.toResidentRecord(resident) : null;
  }

  async findAssignableHouse(rtId: string, houseId: string): Promise<AssignableHouseRecord | null> {
    return this.prisma.house.findFirst({
      where: {
        id: houseId,
        rtId,
        deletedAt: null,
      },
      select: {
        id: true,
        rtId: true,
        status: true,
        deletedAt: true,
      },
    });
  }

  async findTelegramAccount(telegramAccountId: string): Promise<TelegramAccountRecord | null> {
    return this.prisma.telegramAccount.findUnique({
      where: { id: telegramAccountId },
      select: {
        id: true,
        revokedAt: true,
      },
    });
  }

  async findConflictingTelegramBinding(rtId: string, telegramAccountId: string, options?: { exceptResidentId?: string }): Promise<TelegramBindingConflict | null> {
    return this.prisma.telegramBinding.findFirst({
      where: {
        rtId,
        telegramAccountId,
        status: { not: TelegramBindingStatus.REVOKED },
        ...(options?.exceptResidentId
          ? {
              OR: [
                { residentId: null },
                { residentId: { not: options.exceptResidentId } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        residentId: true,
        userId: true,
        membershipId: true,
      },
    });
  }

  async createResident(rtId: string, input: CreateResidentCommand, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertHouseAssignableInTransaction(tx, rtId, input.houseId);
        if (input.telegramAccountId) {
          await this.assertTelegramAccountBindableInTransaction(tx, rtId, input.telegramAccountId);
        }
        const resident = await tx.resident.create({
          data: {
            rtId,
            houseId: input.houseId,
            fullName: input.fullName,
            phone: input.phone,
            defaultJimpitanAmount: input.defaultJimpitanAmount ?? '2000',
            notes: input.notes,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
          select: this.residentDetailSelect(),
        });
        if (input.telegramAccountId) {
          await this.replaceTelegramBinding(tx, rtId, resident.id, input.telegramAccountId);
        }
        await this.markHouseOccupied(tx, rtId, input.houseId, actor, meta);
        const after = await this.findResidentInTransaction(tx, rtId, resident.id, true);
        const afterData = this.toResidentRecord(after);
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'RESIDENT_CREATED',
          entityType: 'resident',
          entityId: resident.id,
          afterData,
        });

        return afterData;
      });
    } catch (error) {
      this.throwUniqueConflict(error);
    }
  }

  async updateResident(rtId: string, residentId: string, input: UpdateResidentCommand, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.findResidentInTransaction(tx, rtId, residentId, false);
        if (!before) {
          return null;
        }

        await tx.resident.update({
          where: { id: residentId },
          data: this.residentUpdateInput(input, actor.userId),
        });
        if (input.telegramAccountId !== undefined) {
          if (input.telegramAccountId) {
            await this.assertTelegramAccountBindableInTransaction(tx, rtId, input.telegramAccountId, residentId);
          }
          await this.replaceTelegramBinding(tx, rtId, residentId, input.telegramAccountId);
        }
        const after = await this.findResidentInTransaction(tx, rtId, residentId, false);
        const beforeData = this.toResidentRecord(before);
        const afterData = this.toResidentRecord(after);
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'RESIDENT_UPDATED',
          entityType: 'resident',
          entityId: residentId,
          beforeData,
          afterData,
        });

        return afterData;
      });
    } catch (error) {
      this.throwUniqueConflict(error);
    }
  }

  async archiveResident(rtId: string, residentId: string, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findResidentInTransaction(tx, rtId, residentId, false);
      if (!before) {
        return null;
      }

      await tx.resident.update({
        where: { id: residentId },
        data: {
          status: ResidentStatus.INACTIVE,
          updatedById: actor.userId,
          deletedById: actor.userId,
          deletedAt: new Date(),
        },
      });
      await this.markHouseEmptyWhenVacant(tx, rtId, before.houseId, actor, meta);
      const after = await this.findResidentInTransaction(tx, rtId, residentId, true);
      const beforeData = this.toResidentRecord(before);
      const afterData = this.toResidentRecord(after);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'RESIDENT_ARCHIVED',
        entityType: 'resident',
        entityId: residentId,
        beforeData,
        afterData,
      });

      return afterData;
    });
  }

  async reactivateResident(rtId: string, residentId: string, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord | null> {
      return this.prisma.$transaction(async (tx) => {
        const before = await this.findResidentInTransaction(tx, rtId, residentId, true);
        if (!before) {
          return null;
        }
        if (before.status === ResidentStatus.ACTIVE) {
          throw new BadRequestException('Resident is already active.');
        }
        await this.assertHouseAssignableInTransaction(tx, rtId, before.houseId);

        await tx.resident.update({
        where: { id: residentId },
        data: {
          status: ResidentStatus.ACTIVE,
          deletedById: null,
          deletedAt: null,
          updatedById: actor.userId,
        },
      });
      await this.markHouseOccupied(tx, rtId, before.houseId, actor, meta);
      const after = await this.findResidentInTransaction(tx, rtId, residentId, false);
      const beforeData = this.toResidentRecord(before);
      const afterData = this.toResidentRecord(after);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'RESIDENT_REACTIVATED',
        entityType: 'resident',
        entityId: residentId,
        beforeData,
        afterData,
      });

      return afterData;
    });
  }

  async moveResident(rtId: string, residentId: string, input: MoveResidentCommand, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findResidentInTransaction(tx, rtId, residentId, false);
      if (!before) {
        return null;
      }
      if (before.status !== ResidentStatus.ACTIVE) {
        throw new BadRequestException('Only active residents can be moved.');
      }
      if (before.houseId === input.houseId) {
        return this.toResidentRecord(before);
      }
      await this.assertHouseAssignableInTransaction(tx, rtId, input.houseId);

      await tx.resident.update({
        where: { id: residentId },
        data: {
          houseId: input.houseId,
          status: ResidentStatus.ACTIVE,
          updatedById: actor.userId,
        },
      });
      await this.markHouseEmptyWhenVacant(tx, rtId, before.houseId, actor, meta);
      await this.markHouseOccupied(tx, rtId, input.houseId, actor, meta);
      const after = await this.findResidentInTransaction(tx, rtId, residentId, false);
      const beforeData = this.toResidentRecord(before);
      const afterData = this.toResidentRecord(after);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'RESIDENT_MOVED_HOUSE',
        entityType: 'resident',
        entityId: residentId,
        beforeData,
        afterData,
      });

      return afterData;
    });
  }

  private residentWhere(rtId: string, query: ResidentListQuery): Prisma.ResidentWhereInput {
    return {
      rtId,
      ...(query.includeArchived ? {} : { deletedAt: null }),
      ...(query.houseId ? { houseId: query.houseId } : {}),
      ...(query.areaId ? { house: { areaId: query.areaId } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { fullName: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { phone: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { house: { houseNumber: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
              { house: { area: { code: { contains: query.search, mode: Prisma.QueryMode.insensitive } } } },
              { house: { area: { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } } } },
            ],
          }
        : {}),
    };
  }

  private residentOrderBy(query: ResidentListQuery): Prisma.ResidentOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'asc';
    switch (query.sortBy ?? 'fullName') {
      case 'areaName':
        return [{ house: { area: { name: direction } } }, { fullName: 'asc' }, { id: 'asc' }];
      case 'houseNumber':
        return [{ house: { houseNumber: direction } }, { fullName: 'asc' }, { id: 'asc' }];
      case 'createdAt':
        return [{ createdAt: direction }, { id: 'asc' }];
      case 'status':
        return [{ status: direction }, { fullName: 'asc' }, { id: 'asc' }];
      case 'fullName':
      default:
        return [{ fullName: direction }, { id: 'asc' }];
    }
  }

  private residentUpdateInput(input: UpdateResidentCommand, actorUserId: string): Prisma.ResidentUpdateInput {
    return {
      ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.defaultJimpitanAmount === undefined ? {} : { defaultJimpitanAmount: input.defaultJimpitanAmount }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      updatedById: actorUserId,
    };
  }

  private async replaceTelegramBinding(tx: Prisma.TransactionClient, rtId: string, residentId: string, telegramAccountId: string | null): Promise<void> {
    await tx.telegramBinding.deleteMany({
      where: {
        rtId,
        residentId,
      },
    });
    if (!telegramAccountId) {
      return;
    }

    await tx.telegramBinding.create({
      data: {
        rtId,
        residentId,
        telegramAccountId,
        status: TelegramBindingStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    });
  }

  private async assertHouseAssignableInTransaction(tx: Prisma.TransactionClient, rtId: string, houseId: string): Promise<void> {
    const house = await tx.house.findFirst({
      where: {
        id: houseId,
        rtId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
      },
    });
    if (!house || house.status === HouseStatus.INACTIVE) {
      throw new BadRequestException('House assignment state changed while processing the request.');
    }
  }

  private async assertTelegramAccountBindableInTransaction(
    tx: Prisma.TransactionClient,
    rtId: string,
    telegramAccountId: string,
    exceptResidentId?: string,
  ): Promise<void> {
    const account = await tx.telegramAccount.findUnique({
      where: { id: telegramAccountId },
      select: {
        id: true,
        revokedAt: true,
      },
    });
    if (!account || account.revokedAt) {
      throw new BadRequestException('Telegram account binding state changed while processing the request.');
    }
    const conflict = await tx.telegramBinding.findFirst({
      where: {
        rtId,
        telegramAccountId,
        status: { not: TelegramBindingStatus.REVOKED },
        ...(exceptResidentId
          ? {
              OR: [
                { residentId: null },
                { residentId: { not: exceptResidentId } },
              ],
            }
          : {}),
      },
      select: { id: true },
    });
    if (conflict) {
      throw new BadRequestException('Telegram account is already bound in this tenant.');
    }
  }

  private async markHouseOccupied(tx: Prisma.TransactionClient, rtId: string, houseId: string, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<void> {
    const before = await this.findHouseForOccupancy(tx, rtId, houseId);
    if (!before || before.status === HouseStatus.OCCUPIED || before.status === HouseStatus.INACTIVE) {
      return;
    }

    const after = await tx.house.update({
      where: { id: houseId },
      data: {
        status: HouseStatus.OCCUPIED,
        updatedById: actor.userId,
      },
      select: this.houseOccupancySelect(),
    });
    await this.writeHouseOccupancyAudit(tx, rtId, actor, meta, before, after);
  }

  private async markHouseEmptyWhenVacant(tx: Prisma.TransactionClient, rtId: string, houseId: string, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<void> {
    const activeResidentCount = await tx.resident.count({
      where: {
        rtId,
        houseId,
        deletedAt: null,
        status: ResidentStatus.ACTIVE,
      },
    });
    if (activeResidentCount > 0) {
      return;
    }

    const before = await this.findHouseForOccupancy(tx, rtId, houseId);
    if (!before || before.status === HouseStatus.EMPTY || before.status === HouseStatus.INACTIVE) {
      return;
    }

    const after = await tx.house.update({
      where: { id: houseId },
      data: {
        status: HouseStatus.EMPTY,
        updatedById: actor.userId,
      },
      select: this.houseOccupancySelect(),
    });
    await this.writeHouseOccupancyAudit(tx, rtId, actor, meta, before, after);
  }

  private async findHouseForOccupancy(tx: Prisma.TransactionClient, rtId: string, houseId: string): Promise<HouseOccupancyRow | null> {
    return tx.house.findFirst({
      where: {
        id: houseId,
        rtId,
        deletedAt: null,
      },
      select: this.houseOccupancySelect(),
    });
  }

  private async findResidentInTransaction(tx: Prisma.TransactionClient, rtId: string, residentId: string, includeArchived: boolean): Promise<ResidentDbRow> {
    const resident = await tx.resident.findFirst({
      where: {
        id: residentId,
        rtId,
        ...(includeArchived ? {} : { deletedAt: null }),
      },
      select: this.residentDetailSelect(),
    });
    if (!resident) {
      throw new BadRequestException('Resident lifecycle state changed while processing the request.');
    }
    return resident;
  }

  private residentListSelect() {
    return {
      id: true,
      rtId: true,
      houseId: true,
      fullName: true,
      phone: true,
      status: true,
      defaultJimpitanAmount: true,
      telegramBindings: {
        where: {
          status: { not: TelegramBindingStatus.REVOKED },
        },
        select: {
          telegramAccountId: true,
        },
        take: 1,
      },
      house: {
        select: this.residentHouseSelect(),
      },
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.ResidentSelect;
  }

  private residentDetailSelect() {
    return {
      ...this.residentListSelect(),
      notes: true,
    } satisfies Prisma.ResidentSelect;
  }

  private residentHouseSelect() {
    return {
      id: true,
      houseNumber: true,
      status: true,
      area: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    } satisfies Prisma.HouseSelect;
  }

  private houseOccupancySelect() {
    return {
      id: true,
      status: true,
      houseNumber: true,
    } satisfies Prisma.HouseSelect;
  }

  private toResidentListRow(resident: ResidentDbRow): ResidentListRow {
    return {
      id: resident.id,
      rtId: resident.rtId,
      houseId: resident.houseId,
      fullName: resident.fullName,
      phone: resident.phone,
      status: resident.status,
      defaultJimpitanAmount: resident.defaultJimpitanAmount.toString(),
      telegramAccountId: resident.telegramBindings[0]?.telegramAccountId ?? null,
      house: resident.house,
      createdAt: resident.createdAt,
      updatedAt: resident.updatedAt,
    };
  }

  private toResidentRecord(resident: ResidentDbRow): ResidentRecord {
    return {
      ...this.toResidentListRow(resident),
      notes: resident.notes ?? null,
    };
  }

  private async writeHouseOccupancyAudit(
    tx: Prisma.TransactionClient,
    rtId: string,
    actor: AuthPrincipal,
    meta: ResidentRequestMeta,
    beforeData: HouseOccupancyRow,
    afterData: HouseOccupancyRow,
  ): Promise<void> {
    await this.writeAudit(tx, {
      rtId,
      actor,
      meta,
      action: 'HOUSE_OCCUPANCY_CHANGED',
      entityType: 'house',
      entityId: afterData.id,
      beforeData,
      afterData,
    });
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    input: {
      rtId: string;
      actor: AuthPrincipal;
      meta: ResidentRequestMeta;
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

  private throwUniqueConflict(error: unknown): never {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Resident or Telegram binding already exists in this tenant.');
    }
    throw error;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
