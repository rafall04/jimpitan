/**
 * Purpose: Prisma persistence adapter for tenant-scoped area and house management.
 * Caller: HousesModule dependency injection for AreasService and HousesService.
 * Deps: PrismaService, Prisma enums/types, house repository port.
 * MainFuncs: Performs scoped area/house CRUD, filtered listing, lifecycle updates, and audit writes.
 * SideEffects: Reads and writes areas, houses, residents counts, and audit_logs table rows.
 */
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { AuditActorType, HouseStatus, Prisma, ResidentStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type {
  AreaListQuery,
  CreateAreaCommand,
  CreateHouseCommand,
  HouseListQuery,
  StructureRequestMeta,
  UpdateAreaCommand,
  UpdateHouseCommand,
} from '../application/houses.commands';
import type { AreaRecord, HouseRecord } from '../domain/houses.types';
import type { HousesRepositoryPort } from './houses.repository.port';

type HouseDbRow = Omit<HouseRecord, 'activeResidentCount'> & {
  _count: {
    residents: number;
  };
};

@Injectable()
export class PrismaHousesRepository implements HousesRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async listAreas(rtId: string, query: AreaListQuery): Promise<PaginatedResult<AreaRecord>> {
    const where = this.areaWhere(rtId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.area.findMany({
        where,
        select: this.areaSelect(),
        orderBy: this.areaOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.area.count({ where }),
    ]);

    return {
      items,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findAreaById(rtId: string, areaId: string): Promise<AreaRecord | null> {
    return this.prisma.area.findFirst({
      where: {
        id: areaId,
        rtId,
        deletedAt: null,
      },
      select: this.areaSelect(),
    });
  }

  async createArea(rtId: string, input: CreateAreaCommand, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<AreaRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const area = await tx.area.create({
          data: {
            rtId,
            code: input.code,
            name: input.name,
            sortOrder: input.sortOrder ?? 0,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
          select: this.areaSelect(),
        });
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'AREA_CREATED',
          entityType: 'area',
          entityId: area.id,
          afterData: area,
        });

        return area;
      });
    } catch (error) {
      this.throwUniqueConflict(error, 'Area code already exists in this tenant.');
    }
  }

  async updateArea(rtId: string, areaId: string, input: UpdateAreaCommand, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<AreaRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.area.findFirst({
          where: {
            id: areaId,
            rtId,
            deletedAt: null,
          },
          select: this.areaSelect(),
        });
        if (!before) {
          return null;
        }

        const after = await tx.area.update({
          where: { id: areaId },
          data: {
            ...input,
            updatedById: actor.userId,
          },
          select: this.areaSelect(),
        });
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'AREA_UPDATED',
          entityType: 'area',
          entityId: areaId,
          beforeData: before,
          afterData: after,
        });

        return after;
      });
    } catch (error) {
      this.throwUniqueConflict(error, 'Area code already exists in this tenant.');
    }
  }

  async archiveArea(rtId: string, areaId: string, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<AreaRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.area.findFirst({
        where: {
          id: areaId,
          rtId,
          deletedAt: null,
        },
        select: this.areaSelect(),
      });
      if (!before) {
        return null;
      }
      const activeHouseCount = await tx.house.count({
        where: {
          rtId,
          areaId,
          deletedAt: null,
          status: { not: HouseStatus.INACTIVE },
        },
      });
      if (activeHouseCount > 0) {
        throw new BadRequestException('Area cannot be archived while active houses still reference it.');
      }

      const after = await tx.area.update({
        where: { id: areaId },
        data: {
          isActive: false,
          updatedById: actor.userId,
          deletedById: actor.userId,
          deletedAt: new Date(),
        },
        select: this.areaSelect(),
      });
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'AREA_ARCHIVED',
        entityType: 'area',
        entityId: areaId,
        beforeData: before,
        afterData: after,
      });

      return after;
    });
  }

  async countActiveHousesInArea(rtId: string, areaId: string): Promise<number> {
    return this.prisma.house.count({
      where: {
        rtId,
        areaId,
        deletedAt: null,
        status: { not: HouseStatus.INACTIVE },
      },
    });
  }

  async listHouses(rtId: string, query: HouseListQuery): Promise<PaginatedResult<HouseRecord>> {
    const where = this.houseWhere(rtId, query);
    const [houses, total] = await this.prisma.$transaction([
      this.prisma.house.findMany({
        where,
        select: this.houseSelect(),
        orderBy: this.houseOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.house.count({ where }),
    ]);

    return {
      items: houses.map((house) => this.toHouseRecord(house)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findHouseById(rtId: string, houseId: string): Promise<HouseRecord | null> {
    const house = await this.prisma.house.findFirst({
      where: {
        id: houseId,
        rtId,
        deletedAt: null,
      },
      select: this.houseSelect(),
    });

    return house ? this.toHouseRecord(house) : null;
  }

  async createHouse(rtId: string, input: CreateHouseCommand, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<HouseRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertAreaAssignableInTransaction(tx, rtId, input.areaId);
        this.assertCreateStatusAllowed(input.status);
        const house = await tx.house.create({
          data: {
            rtId,
            areaId: input.areaId,
            houseNumber: input.houseNumber,
            addressNote: input.addressNote,
            status: input.status ?? HouseStatus.EMPTY,
            createdById: actor.userId,
            updatedById: actor.userId,
          },
          select: this.houseSelect(),
        });
        const afterData = this.toHouseRecord(house);
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'HOUSE_CREATED',
          entityType: 'house',
          entityId: house.id,
          afterData,
        });

        return afterData;
      });
    } catch (error) {
      this.throwUniqueConflict(error, 'House number already exists in this tenant.');
    }
  }

  async updateHouse(rtId: string, houseId: string, input: UpdateHouseCommand, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<HouseRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.house.findFirst({
          where: {
            id: houseId,
            rtId,
            deletedAt: null,
          },
          select: this.houseSelect(),
        });
        if (!before) {
          return null;
        }
        if (input.areaId) {
          await this.assertAreaAssignableInTransaction(tx, rtId, input.areaId);
        }
        await this.assertHouseStatusUpdateAllowedInTransaction(tx, rtId, houseId, input.status);

        const after = await tx.house.update({
          where: { id: houseId },
          data: this.houseUpdateInput(input, actor.userId),
          select: this.houseSelect(),
        });
        const beforeData = this.toHouseRecord(before);
        const afterData = this.toHouseRecord(after);
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'HOUSE_UPDATED',
          entityType: 'house',
          entityId: houseId,
          beforeData,
          afterData,
        });

        if (before.status !== after.status) {
          await this.writeAudit(tx, {
            rtId,
            actor,
            meta,
            action: 'HOUSE_OCCUPANCY_CHANGED',
            entityType: 'house',
            entityId: houseId,
            beforeData,
            afterData,
          });
        }

        return afterData;
      });
    } catch (error) {
      this.throwUniqueConflict(error, 'House number already exists in this tenant.');
    }
  }

  async archiveHouse(rtId: string, houseId: string, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<HouseRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.house.findFirst({
        where: {
          id: houseId,
          rtId,
          deletedAt: null,
        },
        select: this.houseSelect(),
      });
      if (!before) {
        return null;
      }
      const activeResidentCount = await tx.resident.count({
        where: {
          rtId,
          houseId,
          deletedAt: null,
          status: ResidentStatus.ACTIVE,
        },
      });
      if (activeResidentCount > 0) {
        throw new BadRequestException('House cannot be archived while active residents are assigned.');
      }

      const after = await tx.house.update({
        where: { id: houseId },
        data: {
          status: HouseStatus.INACTIVE,
          updatedById: actor.userId,
          deletedById: actor.userId,
          deletedAt: new Date(),
        },
        select: this.houseSelect(),
      });
      const beforeData = this.toHouseRecord(before);
      const afterData = this.toHouseRecord(after);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'HOUSE_ARCHIVED',
        entityType: 'house',
        entityId: houseId,
        beforeData,
        afterData,
      });
      if (before.status !== after.status) {
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'HOUSE_OCCUPANCY_CHANGED',
          entityType: 'house',
          entityId: houseId,
          beforeData,
          afterData,
        });
      }

      return afterData;
    });
  }

  async countActiveResidentsInHouse(rtId: string, houseId: string): Promise<number> {
    return this.prisma.resident.count({
      where: {
        rtId,
        houseId,
        deletedAt: null,
        status: ResidentStatus.ACTIVE,
      },
    });
  }

  private areaWhere(rtId: string, query: AreaListQuery): Prisma.AreaWhereInput {
    return {
      rtId,
      deletedAt: null,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };
  }

  private houseWhere(rtId: string, query: HouseListQuery): Prisma.HouseWhereInput {
    return {
      rtId,
      deletedAt: null,
      ...(query.areaId ? { areaId: query.areaId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { houseNumber: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { addressNote: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { area: { code: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
              { area: { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    };
  }

  private areaOrderBy(query: AreaListQuery): Prisma.AreaOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'asc';
    const sortBy = query.sortBy ?? 'sortOrder';
    return [{ [sortBy]: direction }, { id: 'asc' }];
  }

  private houseOrderBy(query: HouseListQuery): Prisma.HouseOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'asc';
    switch (query.sortBy ?? 'houseNumber') {
      case 'areaName':
        return [{ area: { name: direction } }, { houseNumber: 'asc' }, { id: 'asc' }];
      case 'createdAt':
        return [{ createdAt: direction }, { id: 'asc' }];
      case 'status':
        return [{ status: direction }, { houseNumber: 'asc' }, { id: 'asc' }];
      case 'houseNumber':
      default:
        return [{ houseNumber: direction }, { id: 'asc' }];
    }
  }

  private houseUpdateInput(input: UpdateHouseCommand, actorUserId: string): Prisma.HouseUpdateInput {
    return {
      ...(input.areaId ? { area: { connect: { id: input.areaId } } } : {}),
      ...(input.houseNumber === undefined ? {} : { houseNumber: input.houseNumber }),
      ...(input.addressNote === undefined ? {} : { addressNote: input.addressNote }),
      ...(input.status === undefined ? {} : { status: input.status }),
      updatedById: actorUserId,
    };
  }

  private async assertAreaAssignableInTransaction(tx: Prisma.TransactionClient, rtId: string, areaId: string): Promise<void> {
    const area = await tx.area.findFirst({
      where: {
        id: areaId,
        rtId,
        deletedAt: null,
      },
      select: {
        id: true,
        isActive: true,
      },
    });
    if (!area || !area.isActive) {
      throw new BadRequestException('Area assignment state changed while processing the request.');
    }
  }

  private async assertHouseStatusUpdateAllowedInTransaction(tx: Prisma.TransactionClient, rtId: string, houseId: string, status?: HouseStatus): Promise<void> {
    if (status === undefined) {
      return;
    }
    this.assertManualStatusAllowed(status);
    const activeResidentCount = await tx.resident.count({
      where: {
        rtId,
        houseId,
        deletedAt: null,
        status: ResidentStatus.ACTIVE,
      },
    });
    if (status === HouseStatus.EMPTY && activeResidentCount > 0) {
      throw new BadRequestException('House cannot be marked empty while active residents are assigned.');
    }
    if (status === HouseStatus.OCCUPIED && activeResidentCount === 0) {
      throw new BadRequestException('House cannot be marked occupied without active residents.');
    }
  }

  private assertCreateStatusAllowed(status?: HouseStatus): void {
    if (status === HouseStatus.OCCUPIED) {
      throw new BadRequestException('House occupancy is derived from active resident assignments.');
    }
    this.assertManualStatusAllowed(status);
  }

  private assertManualStatusAllowed(status?: HouseStatus): void {
    if (status === HouseStatus.INACTIVE) {
      throw new BadRequestException('Use the archive endpoint to mark a house inactive.');
    }
  }

  private areaSelect() {
    return {
      id: true,
      rtId: true,
      code: true,
      name: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.AreaSelect;
  }

  private houseSelect() {
    return {
      id: true,
      rtId: true,
      areaId: true,
      houseNumber: true,
      addressNote: true,
      status: true,
      area: {
        select: {
          id: true,
          code: true,
          name: true,
          sortOrder: true,
        },
      },
      _count: {
        select: {
          residents: {
            where: {
              deletedAt: null,
              status: ResidentStatus.ACTIVE,
            },
          },
        },
      },
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.HouseSelect;
  }

  private toHouseRecord(house: HouseDbRow): HouseRecord {
    return {
      id: house.id,
      rtId: house.rtId,
      areaId: house.areaId,
      houseNumber: house.houseNumber,
      addressNote: house.addressNote,
      status: house.status,
      area: house.area,
      activeResidentCount: house._count.residents,
      createdAt: house.createdAt,
      updatedAt: house.updatedAt,
    };
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    input: {
      rtId: string;
      actor: AuthPrincipal;
      meta: StructureRequestMeta;
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

  private throwUniqueConflict(error: unknown, message: string): never {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
