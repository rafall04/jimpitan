/**
 * Purpose: Prisma persistence adapter for tenant-scoped jimpitan collection workflows.
 * Caller: JimpitanModule dependency injection for JimpitanService.
 * Deps: PrismaService, Prisma enums/types, AuthPrincipal, and jimpitan repository port.
 * MainFuncs: Performs scoped collection CRUD, mode-aware total input, checklist generation, item upserts, lifecycle transitions, summaries, outstanding tracking, and audit writes.
 * SideEffects: Reads and writes jimpitan_schedules, jimpitan_collections, collection_items, and audit_logs.
 */
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  AuditActorType,
  CollectionItemStatus,
  CollectionMode as PrismaCollectionMode,
  CollectionStatus,
  HouseStatus,
  MembershipStatus,
  Prisma,
  ResidentStatus,
  ScheduleStatus,
  ScheduleType,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import type { PaginatedResult, PaginationInput } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type {
  CancelCollectionCommand,
  CollectionItemCommand,
  CollectionListQuery,
  CreateCollectionCommand,
  JimpitanRequestMeta,
  RejectCollectionCommand,
  SetBulkCollectionTotalCommand,
  SubmitCollectionCommand,
  UpdateCollectionCommand,
  UpsertCollectionItemsCommand,
  ValidateCollectionCommand,
} from '../application/jimpitan.commands';
import { assertBulkTotalAmount, assertCollectionModeSubmissionReady, assertPerHouseItemsAllowed } from '../application/collection-mode.policy';
import { DEFAULT_COLLECTION_MODE } from '../domain/collection-mode.types';
import type {
  CollectionAreaProgress,
  CollectionAreaRecord,
  CollectionChecklist,
  CollectionChecklistHouse,
  CollectionItemRecord,
  CollectionSessionRecord,
  CollectionSummary,
  OfficerMembershipRecord,
  OutstandingHouseRecord,
} from '../domain/jimpitan.types';
import type { JimpitanRepositoryPort } from './jimpitan.repository.port';

type CollectionDbRow = {
  id: string;
  rtId: string;
  scheduleId: string | null;
  officerMembershipId: string;
  collectionDate: Date;
  collectionMode: PrismaCollectionMode;
  status: CollectionStatus;
  note: string | null;
  totalAmount: Prisma.Decimal;
  submittedAt: Date | null;
  validatedAt: Date | null;
  rejectedAt: Date | null;
  cancelledAt: Date | null;
  validationNote: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  updatedAt: Date;
  officerMembership: {
    id: string;
    userId: string;
    user: {
      fullName: string;
    };
  };
  schedule: {
    areaId: string | null;
    area: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
  _count: {
    items: number;
  };
};

type HouseChecklistRow = {
  id: string;
  houseNumber: string;
  area: {
    id: string;
    code: string;
    name: string;
  };
  residents: Array<{
    id: string;
    fullName: string;
    defaultJimpitanAmount: Prisma.Decimal;
  }>;
};

type ItemDbRow = {
  id: string;
  houseId: string;
  residentId: string | null;
  amount: Prisma.Decimal;
  status: CollectionItemStatus;
  note: string | null;
  updatedAt: Date;
};

@Injectable()
export class PrismaJimpitanRepository implements JimpitanRepositoryPort {
  private readonly activeCollectionStatuses = [CollectionStatus.DRAFT, CollectionStatus.IN_PROGRESS, CollectionStatus.SUBMITTED] as const;
  private readonly editableCollectionStatuses: CollectionStatus[] = [CollectionStatus.DRAFT, CollectionStatus.IN_PROGRESS, CollectionStatus.REJECTED];
  private readonly settledCollectionItemStatuses: CollectionItemStatus[] = [CollectionItemStatus.PAID, CollectionItemStatus.DISPENSATION];

  constructor(private readonly prisma: PrismaService) {}

  async listCollections(rtId: string, query: CollectionListQuery): Promise<PaginatedResult<CollectionSessionRecord>> {
    const where = this.collectionWhere(rtId, query);
    const [collections, total] = await this.prisma.$transaction([
      this.prisma.jimpitanCollection.findMany({
        where,
        select: this.collectionSelect(),
        orderBy: this.collectionOrderBy(query),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.jimpitanCollection.count({ where }),
    ]);

    return {
      items: collections.map((collection) => this.toCollectionRecord(collection)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findCollectionById(rtId: string, collectionId: string): Promise<CollectionSessionRecord | null> {
    const collection = await this.prisma.jimpitanCollection.findFirst({
      where: { id: collectionId, rtId },
      select: this.collectionSelect(),
    });

    return collection ? this.toCollectionRecord(collection) : null;
  }

  async findOfficerMembership(rtId: string, membershipId: string): Promise<OfficerMembershipRecord | null> {
    return this.prisma.rtMembership.findFirst({
      where: {
        id: membershipId,
        rtId,
        status: MembershipStatus.ACTIVE,
        user: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      },
      select: {
        id: true,
        rtId: true,
        status: true,
      },
    });
  }

  async findArea(rtId: string, areaId: string): Promise<CollectionAreaRecord | null> {
    return this.prisma.area.findFirst({
      where: {
        id: areaId,
        rtId,
        deletedAt: null,
      },
      select: {
        id: true,
        rtId: true,
        isActive: true,
      },
    });
  }

  async hasActiveCollectionForRouteDate(rtId: string, input: { collectionDate: string; areaId?: string | null; excludeCollectionId?: string }): Promise<boolean> {
    const count = await this.prisma.jimpitanCollection.count({
      where: this.activeDuplicateWhere(rtId, input),
    });

    return count > 0;
  }

  async createCollection(rtId: string, input: CreateCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.assertOfficerAssignableInTransaction(tx, rtId, input.officerMembershipId);
          await this.assertAreaAssignableInTransaction(tx, rtId, input.areaId);
          await this.assertNoActiveDuplicateInTransaction(tx, rtId, {
            collectionDate: input.collectionDate,
            areaId: input.areaId ?? null,
          });
          const scheduleId = await this.findOrCreateSchedule(tx, rtId, input.officerMembershipId, input.collectionDate, input.areaId ?? null, actor.userId);
          const collectionMode = input.collectionMode ?? DEFAULT_COLLECTION_MODE;
          const collection = await tx.jimpitanCollection.create({
            data: {
              rtId,
              scheduleId,
              officerMembershipId: input.officerMembershipId,
              collectionDate: this.toDate(input.collectionDate),
              collectionMode,
              status: CollectionStatus.DRAFT,
              totalAmount: input.totalAmount ? new Prisma.Decimal(input.totalAmount) : new Prisma.Decimal(0),
              note: input.note,
              createdById: actor.userId,
              updatedById: actor.userId,
            },
            select: this.collectionSelect(),
          });
          const afterData = this.toCollectionRecord(collection);
          await this.writeAudit(tx, { rtId, actor, meta, action: 'COLLECTION_CREATED', entityType: 'jimpitan_collection', entityId: collection.id, afterData });
          await this.writeAudit(tx, { rtId, actor, meta, action: 'COLLECTION_OFFICER_ASSIGNED', entityType: 'jimpitan_collection', entityId: collection.id, afterData });

          return afterData;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.throwKnownConflict(error, 'Collection could not be created because a duplicate route, schedule, or request key already exists.');
    }
  }

  async updateCollection(rtId: string, collectionId: string, input: UpdateCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
          if (!before) {
            return null;
          }
          this.assertEditableStatus(before.status);

          const officerMembershipId = input.officerMembershipId ?? before.officerMembershipId;
          const collectionDate = input.collectionDate ?? this.toDateOnly(before.collectionDate);
          const areaId = input.areaId === undefined ? before.schedule?.areaId ?? null : input.areaId;
          const collectionMode = input.collectionMode ?? before.collectionMode;
          if (input.officerMembershipId) {
            await this.assertOfficerAssignableInTransaction(tx, rtId, input.officerMembershipId);
          }
          if (areaId) {
            await this.assertAreaAssignableInTransaction(tx, rtId, areaId);
          }
          if (input.officerMembershipId || input.collectionDate || input.areaId !== undefined) {
            await this.assertNoActiveDuplicateInTransaction(tx, rtId, { collectionDate, areaId, excludeCollectionId: collectionId });
          }

          const scheduleId = await this.findOrCreateSchedule(tx, rtId, officerMembershipId, collectionDate, areaId, actor.userId);
          const update = await tx.jimpitanCollection.updateMany({
            where: { id: collectionId, rtId, status: { in: this.editableCollectionStatuses } },
            data: {
              officerMembershipId,
              collectionDate: this.toDate(collectionDate),
              scheduleId,
              collectionMode,
              ...(input.collectionMode === PrismaCollectionMode.PER_HOUSE ? { totalAmount: new Prisma.Decimal(0) } : {}),
              ...(input.totalAmount === undefined || input.totalAmount === null ? {} : { totalAmount: new Prisma.Decimal(input.totalAmount) }),
              ...(input.note === undefined ? {} : { note: input.note }),
              updatedById: actor.userId,
            },
          });
          this.assertSingleStateUpdate(update.count);
          const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
          const beforeData = this.toCollectionRecord(before);
          const afterData = this.toCollectionRecord(after);
          await this.writeAudit(tx, { rtId, actor, meta, action: 'COLLECTION_UPDATED', entityType: 'jimpitan_collection', entityId: collectionId, beforeData, afterData });
          if (before.officerMembershipId !== after.officerMembershipId) {
            await this.writeAudit(tx, { rtId, actor, meta, action: 'COLLECTION_OFFICER_ASSIGNED', entityType: 'jimpitan_collection', entityId: collectionId, beforeData, afterData });
          }

          return afterData;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.throwKnownConflict(error, 'Collection could not be updated because a duplicate route, schedule, or request key already exists.');
    }
  }

  async startCollection(rtId: string, collectionId: string, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null> {
    return this.transitionCollection(rtId, collectionId, actor, meta, {
      allowed: [CollectionStatus.DRAFT, CollectionStatus.REJECTED],
      action: 'COLLECTION_STARTED',
      data: { status: CollectionStatus.IN_PROGRESS, updatedById: actor.userId },
    });
  }

  async cancelCollection(rtId: string, collectionId: string, input: CancelCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
      if (!before) {
        return null;
      }
      if (before.status === CollectionStatus.VALIDATED) {
        throw new BadRequestException('Validated collections cannot be cancelled.');
      }
      const update = await tx.jimpitanCollection.updateMany({
        where: { id: collectionId, rtId, status: { not: CollectionStatus.VALIDATED } },
        data: {
          status: CollectionStatus.CANCELLED,
          cancelledById: actor.userId,
          cancelledAt: new Date(),
          cancellationReason: input.cancellationReason,
          updatedById: actor.userId,
        },
      });
      this.assertSingleStateUpdate(update.count);
      const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'COLLECTION_CANCELLED',
        entityType: 'jimpitan_collection',
        entityId: collectionId,
        beforeData: this.toCollectionRecord(before),
        afterData: this.toCollectionRecord(after),
      });

      return this.toCollectionRecord(after);
    });
  }

  async getChecklist(rtId: string, collectionId: string): Promise<CollectionChecklist | null> {
    const collection = await this.findCollectionById(rtId, collectionId);
    if (!collection) {
      return null;
    }
    if (collection.collectionMode === PrismaCollectionMode.BULK_TOTAL) {
      return { collection, houses: [] };
    }
    const [houses, items] = await this.prisma.$transaction([
      this.prisma.house.findMany({
        where: this.routeHouseWhere(rtId, collection.route.areaId),
        select: this.checklistHouseSelect(),
        orderBy: [{ area: { sortOrder: 'asc' } }, { houseNumber: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.collectionItem.findMany({
        where: { rtId, collectionId },
        select: this.collectionItemSelect(),
      }),
    ]);

    return this.toChecklist(collection, houses, items);
  }

  async generateChecklist(rtId: string, collectionId: string, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionChecklist | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
      if (!before) {
        return null;
      }
      this.assertEditableStatus(before.status);
      assertPerHouseItemsAllowed(before.collectionMode);
      if (before.status === CollectionStatus.DRAFT || before.status === CollectionStatus.REJECTED) {
        const update = await tx.jimpitanCollection.updateMany({
          where: { id: collectionId, rtId, status: before.status },
          data: { status: CollectionStatus.IN_PROGRESS, updatedById: actor.userId },
        });
        this.assertSingleStateUpdate(update.count);
      }
      const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'COLLECTION_CHECKLIST_GENERATED',
        entityType: 'jimpitan_collection',
        entityId: collectionId,
        beforeData: this.toCollectionRecord(before),
        afterData: this.toCollectionRecord(after),
      });
      const [houses, items] = await Promise.all([
        tx.house.findMany({
          where: this.routeHouseWhere(rtId, after.schedule?.areaId ?? null),
          select: this.checklistHouseSelect(),
          orderBy: [{ area: { sortOrder: 'asc' } }, { houseNumber: 'asc' }, { id: 'asc' }],
        }),
        tx.collectionItem.findMany({ where: { rtId, collectionId }, select: this.collectionItemSelect() }),
      ]);

      return this.toChecklist(this.toCollectionRecord(after), houses, items);
    });
  }

  async upsertCollectionItems(rtId: string, collectionId: string, input: UpsertCollectionItemsCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
        if (!before) {
          return null;
        }
        this.assertEditableStatus(before.status);
        assertPerHouseItemsAllowed(before.collectionMode);
        await this.assertItemsAssignableInTransaction(tx, rtId, before.schedule?.areaId ?? null, input.items);

        for (const item of input.items) {
          await tx.collectionItem.upsert({
            where: { collectionId_houseId: { collectionId, houseId: item.houseId } },
            create: {
              rtId,
              collectionId,
              houseId: item.houseId,
              residentId: item.residentId ?? null,
              amount: item.amount,
              status: item.status,
              note: item.note,
              createdById: actor.userId,
              updatedById: actor.userId,
            },
            update: {
              residentId: item.residentId ?? null,
              amount: item.amount,
              status: item.status,
              note: item.note,
              updatedById: actor.userId,
            },
          });
        }
        const totalAmount = await this.calculatePaidTotal(tx, rtId, collectionId);
        const update = await tx.jimpitanCollection.updateMany({
          where: { id: collectionId, rtId, status: { in: this.editableCollectionStatuses } },
          data: {
            totalAmount,
            status: before.status === CollectionStatus.DRAFT || before.status === CollectionStatus.REJECTED ? CollectionStatus.IN_PROGRESS : before.status,
            updatedById: actor.userId,
          },
        });
        this.assertSingleStateUpdate(update.count);
        const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
        await this.writeAudit(tx, {
          rtId,
          actor,
          meta,
          action: 'COLLECTION_ITEM_CHANGED',
          entityType: 'jimpitan_collection',
          entityId: collectionId,
          beforeData: this.toCollectionRecord(before),
          afterData: { collection: this.toCollectionRecord(after), items: input.items },
        });

        return this.toCollectionRecord(after);
      });
    } catch (error) {
      this.throwKnownConflict(error, 'Collection item could not be saved because a duplicate house item exists.');
    }
  }

  async setBulkCollectionTotal(
    rtId: string,
    collectionId: string,
    input: SetBulkCollectionTotalCommand,
    actor: AuthPrincipal,
    meta: JimpitanRequestMeta,
  ): Promise<CollectionSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
      if (!before) {
        return null;
      }
      this.assertEditableStatus(before.status);
      if (before.collectionMode !== PrismaCollectionMode.BULK_TOTAL) {
        throw new BadRequestException('Only BULK_TOTAL collections accept session total input.');
      }
      assertBulkTotalAmount({ collectionMode: before.collectionMode, totalAmount: input.totalAmount });
      const update = await tx.jimpitanCollection.updateMany({
        where: { id: collectionId, rtId, status: { in: this.editableCollectionStatuses }, collectionMode: PrismaCollectionMode.BULK_TOTAL },
        data: {
          totalAmount: new Prisma.Decimal(input.totalAmount),
          note: input.note === undefined ? before.note : input.note,
          status: before.status === CollectionStatus.DRAFT || before.status === CollectionStatus.REJECTED ? CollectionStatus.IN_PROGRESS : before.status,
          updatedById: actor.userId,
        },
      });
      this.assertSingleStateUpdate(update.count);
      const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'COLLECTION_BULK_TOTAL_CHANGED',
        entityType: 'jimpitan_collection',
        entityId: collectionId,
        beforeData: this.toCollectionRecord(before),
        afterData: this.toCollectionRecord(after),
      });

      return this.toCollectionRecord(after);
    });
  }

  async submitCollection(rtId: string, collectionId: string, input: SubmitCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
      if (!before) {
        return null;
      }
      this.assertEditableStatus(before.status);
      const itemCount = await tx.collectionItem.count({ where: { rtId, collectionId } });
      const totalAmount = before.collectionMode === PrismaCollectionMode.BULK_TOTAL ? before.totalAmount : await this.calculatePaidTotal(tx, rtId, collectionId);
      assertCollectionModeSubmissionReady({
        collectionId,
        collectionMode: before.collectionMode,
        totalAmount: totalAmount.toString(),
        itemCount,
      });
      const update = await tx.jimpitanCollection.updateMany({
        where: { id: collectionId, rtId, status: { in: this.editableCollectionStatuses } },
        data: {
          status: CollectionStatus.SUBMITTED,
          submitRequestId: input.submitRequestId,
          submittedAt: new Date(),
          totalAmount,
          updatedById: actor.userId,
        },
      });
      this.assertSingleStateUpdate(update.count);
      const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'COLLECTION_SUBMITTED',
        entityType: 'jimpitan_collection',
        entityId: collectionId,
        beforeData: this.toCollectionRecord(before),
        afterData: this.toCollectionRecord(after),
      });

      return this.toCollectionRecord(after);
    });
  }

  async validateCollection(rtId: string, collectionId: string, input: ValidateCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
      if (!before) {
        return null;
      }
      if (before.status !== CollectionStatus.SUBMITTED) {
        throw new BadRequestException('Only submitted collections can be validated.');
      }
      const itemCount = before.collectionMode === PrismaCollectionMode.BULK_TOTAL ? before._count.items : await tx.collectionItem.count({ where: { rtId, collectionId } });
      assertCollectionModeSubmissionReady({
        collectionId,
        collectionMode: before.collectionMode,
        totalAmount: before.totalAmount.toString(),
        itemCount,
      });
      const update = await tx.jimpitanCollection.updateMany({
        where: { id: collectionId, rtId, status: CollectionStatus.SUBMITTED },
        data: {
          status: CollectionStatus.VALIDATED,
          validatedById: actor.userId,
          validatedAt: new Date(),
          validationNote: input.validationNote,
          updatedById: actor.userId,
        },
      });
      this.assertSingleStateUpdate(update.count);
      if (before.scheduleId) {
        await tx.jimpitanSchedule.update({
          where: { id: before.scheduleId },
          data: { status: ScheduleStatus.COMPLETED, completedAt: new Date(), updatedById: actor.userId },
        });
      }
      const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'COLLECTION_VALIDATED',
        entityType: 'jimpitan_collection',
        entityId: collectionId,
        beforeData: this.toCollectionRecord(before),
        afterData: this.toCollectionRecord(after),
      });

      return this.toCollectionRecord(after);
    });
  }

  async rejectCollection(rtId: string, collectionId: string, input: RejectCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
      if (!before) {
        return null;
      }
      if (before.status !== CollectionStatus.SUBMITTED) {
        throw new BadRequestException('Only submitted collections can be rejected.');
      }
      const update = await tx.jimpitanCollection.updateMany({
        where: { id: collectionId, rtId, status: CollectionStatus.SUBMITTED },
        data: {
          status: CollectionStatus.REJECTED,
          rejectedById: actor.userId,
          rejectedAt: new Date(),
          rejectionReason: input.rejectionReason,
          updatedById: actor.userId,
        },
      });
      this.assertSingleStateUpdate(update.count);
      const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: 'COLLECTION_REJECTED',
        entityType: 'jimpitan_collection',
        entityId: collectionId,
        beforeData: this.toCollectionRecord(before),
        afterData: this.toCollectionRecord(after),
      });

      return this.toCollectionRecord(after);
    });
  }

  async getCollectionSummary(rtId: string, collectionId: string): Promise<CollectionSummary | null> {
    const checklist = await this.getChecklist(rtId, collectionId);
    if (!checklist) {
      return null;
    }
    if (checklist.collection.collectionMode === PrismaCollectionMode.BULK_TOTAL) {
      return this.toBulkTotalSummary(checklist.collection);
    }
    return this.toSummary(checklist.collection, checklist.houses);
  }

  async getOutstandingHouses(rtId: string, collectionId: string, pagination: PaginationInput): Promise<PaginatedResult<OutstandingHouseRecord>> {
    const checklist = await this.getChecklist(rtId, collectionId);
    if (!checklist) {
      return { items: [], page: pagination.page, limit: pagination.limit, total: 0, totalPages: 0 };
    }
    if (checklist.collection.collectionMode === PrismaCollectionMode.BULK_TOTAL) {
      return { items: [], page: pagination.page, limit: pagination.limit, total: 0, totalPages: 0 };
    }
    const outstanding = checklist.houses
      .filter((house) => !house.item || !this.settledCollectionItemStatuses.includes(house.item.status))
      .map((house) => ({
        ...house,
        outstandingStatus: house.item?.status ?? ('NO_INPUT' as const),
      }));
    const start = (pagination.page - 1) * pagination.limit;
    const items = outstanding.slice(start, start + pagination.limit);

    return {
      items,
      page: pagination.page,
      limit: pagination.limit,
      total: outstanding.length,
      totalPages: Math.ceil(outstanding.length / pagination.limit),
    };
  }

  private collectionWhere(rtId: string, query: CollectionListQuery): Prisma.JimpitanCollectionWhereInput {
    return {
      rtId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.collectionMode ? { collectionMode: query.collectionMode } : {}),
      ...(query.officerMembershipId ? { officerMembershipId: query.officerMembershipId } : {}),
      ...(query.areaId ? { schedule: { areaId: query.areaId } } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            collectionDate: {
              ...(query.dateFrom ? { gte: this.toDate(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: this.toDate(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { officerMembership: { user: { fullName: { contains: query.search, mode: Prisma.QueryMode.insensitive } } } },
              { schedule: { area: { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } } } },
              { schedule: { area: { code: { contains: query.search, mode: Prisma.QueryMode.insensitive } } } },
              { note: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }
        : {}),
    };
  }

  private activeDuplicateWhere(rtId: string, input: { collectionDate: string; areaId?: string | null; excludeCollectionId?: string }): Prisma.JimpitanCollectionWhereInput {
    return {
      rtId,
      collectionDate: this.toDate(input.collectionDate),
      status: { in: [...this.activeCollectionStatuses] },
      schedule: { is: { areaId: input.areaId ?? null } },
      ...(input.excludeCollectionId ? { id: { not: input.excludeCollectionId } } : {}),
    };
  }

  private async assertNoActiveDuplicateInTransaction(tx: Prisma.TransactionClient, rtId: string, input: { collectionDate: string; areaId?: string | null; excludeCollectionId?: string }): Promise<void> {
    const count = await tx.jimpitanCollection.count({ where: this.activeDuplicateWhere(rtId, input) });
    if (count > 0) {
      throw new BadRequestException('An active collection already exists for this route and date.');
    }
  }

  private async assertOfficerAssignableInTransaction(tx: Prisma.TransactionClient, rtId: string, membershipId: string): Promise<void> {
    const officer = await tx.rtMembership.findFirst({
      where: {
        id: membershipId,
        rtId,
        status: MembershipStatus.ACTIVE,
        user: {
          deletedAt: null,
          status: 'ACTIVE',
        },
      },
      select: { id: true },
    });
    if (!officer) {
      throw new BadRequestException('Officer assignment state changed while processing the request.');
    }
  }

  private async assertAreaAssignableInTransaction(tx: Prisma.TransactionClient, rtId: string, areaId?: string | null): Promise<void> {
    if (!areaId) {
      return;
    }
    const area = await tx.area.findFirst({
      where: { id: areaId, rtId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!area) {
      throw new BadRequestException('Area assignment state changed while processing the request.');
    }
  }

  private async assertItemsAssignableInTransaction(tx: Prisma.TransactionClient, rtId: string, areaId: string | null, items: CollectionItemCommand[]): Promise<void> {
    const houseIds = items.map((item) => item.houseId);
    const houses = await tx.house.findMany({
      where: {
        id: { in: houseIds },
        ...this.routeHouseWhere(rtId, areaId),
      },
      select: { id: true },
    });
    if (houses.length !== new Set(houseIds).size) {
      throw new BadRequestException('One or more houses are not assignable to this collection route.');
    }

    const residentPairs = items.filter((item) => item.residentId).map((item) => ({ residentId: item.residentId as string, houseId: item.houseId }));
    if (residentPairs.length === 0) {
      return;
    }
    const residents = await tx.resident.findMany({
      where: {
        id: { in: residentPairs.map((pair) => pair.residentId) },
        rtId,
        deletedAt: null,
        status: ResidentStatus.ACTIVE,
      },
      select: { id: true, houseId: true },
    });
    const residentHouseMap = new Map(residents.map((resident) => [resident.id, resident.houseId]));
    const allResidentsMatchHouse = residentPairs.every((pair) => residentHouseMap.get(pair.residentId) === pair.houseId);
    if (!allResidentsMatchHouse) {
      throw new BadRequestException('One or more residents are not active in the selected houses.');
    }
  }

  private routeHouseWhere(rtId: string, areaId: string | null): Prisma.HouseWhereInput {
    return {
      rtId,
      deletedAt: null,
      status: { not: HouseStatus.INACTIVE },
      ...(areaId ? { areaId } : {}),
      area: {
        deletedAt: null,
        isActive: true,
      },
    };
  }

  private async findOrCreateSchedule(tx: Prisma.TransactionClient, rtId: string, officerMembershipId: string, collectionDate: string, areaId: string | null, actorUserId: string): Promise<string> {
    const scheduleDate = this.toDate(collectionDate);
    const existing = await tx.jimpitanSchedule.findFirst({
      where: {
        rtId,
        officerMembershipId,
        scheduleDate,
        areaId,
      },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const schedule = await tx.jimpitanSchedule.create({
      data: {
        rtId,
        officerMembershipId,
        scheduleDate,
        areaId,
        scheduleType: ScheduleType.CUSTOM,
        status: ScheduleStatus.SCHEDULED,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
      select: { id: true },
    });

    return schedule.id;
  }

  private async transitionCollection(
    rtId: string,
    collectionId: string,
    actor: AuthPrincipal,
    meta: JimpitanRequestMeta,
    input: { allowed: CollectionStatus[]; action: string; data: Prisma.JimpitanCollectionUpdateManyMutationInput },
  ): Promise<CollectionSessionRecord | null> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.findCollectionInTransaction(tx, rtId, collectionId);
      if (!before) {
        return null;
      }
      if (!input.allowed.includes(before.status)) {
        throw new BadRequestException('Collection cannot transition from its current status.');
      }
      const update = await tx.jimpitanCollection.updateMany({
        where: { id: collectionId, rtId, status: { in: input.allowed } },
        data: input.data,
      });
      this.assertSingleStateUpdate(update.count);
      const after = await this.findCollectionInTransactionOrThrow(tx, rtId, collectionId);
      await this.writeAudit(tx, {
        rtId,
        actor,
        meta,
        action: input.action,
        entityType: 'jimpitan_collection',
        entityId: collectionId,
        beforeData: this.toCollectionRecord(before),
        afterData: this.toCollectionRecord(after),
      });
      return this.toCollectionRecord(after);
    });
  }

  private async calculatePaidTotal(tx: Prisma.TransactionClient, rtId: string, collectionId: string): Promise<Prisma.Decimal> {
    const aggregate = await tx.collectionItem.aggregate({
      where: { rtId, collectionId, status: CollectionItemStatus.PAID },
      _sum: { amount: true },
    });

    return aggregate._sum.amount ?? new Prisma.Decimal(0);
  }

  private collectionOrderBy(query: CollectionListQuery): Prisma.JimpitanCollectionOrderByWithRelationInput[] {
    const direction = query.sortDirection ?? 'desc';
    switch (query.sortBy ?? 'collectionDate') {
      case 'status':
        return [{ status: direction }, { collectionDate: 'desc' }, { id: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'collectionDate':
      default:
        return [{ collectionDate: direction }, { id: 'asc' }];
    }
  }

  private collectionSelect() {
    return {
      id: true,
      rtId: true,
      scheduleId: true,
      officerMembershipId: true,
      collectionDate: true,
      collectionMode: true,
      status: true,
      note: true,
      totalAmount: true,
      submittedAt: true,
      validatedAt: true,
      rejectedAt: true,
      cancelledAt: true,
      validationNote: true,
      rejectionReason: true,
      cancellationReason: true,
      updatedAt: true,
      officerMembership: {
        select: {
          id: true,
          userId: true,
          user: { select: { fullName: true } },
        },
      },
      schedule: {
        select: {
          areaId: true,
          area: { select: { id: true, code: true, name: true } },
        },
      },
      _count: { select: { items: true } },
    } satisfies Prisma.JimpitanCollectionSelect;
  }

  private collectionItemSelect() {
    return {
      id: true,
      houseId: true,
      residentId: true,
      amount: true,
      status: true,
      note: true,
      updatedAt: true,
    } satisfies Prisma.CollectionItemSelect;
  }

  private checklistHouseSelect() {
    return {
      id: true,
      houseNumber: true,
      area: { select: { id: true, code: true, name: true } },
      residents: {
        where: {
          deletedAt: null,
          status: ResidentStatus.ACTIVE,
        },
        select: {
          id: true,
          fullName: true,
          defaultJimpitanAmount: true,
        },
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        take: 1,
      },
    } satisfies Prisma.HouseSelect;
  }

  private async findCollectionInTransaction(tx: Prisma.TransactionClient, rtId: string, collectionId: string): Promise<CollectionDbRow | null> {
    return tx.jimpitanCollection.findFirst({
      where: { id: collectionId, rtId },
      select: this.collectionSelect(),
    });
  }

  private async findCollectionInTransactionOrThrow(tx: Prisma.TransactionClient, rtId: string, collectionId: string): Promise<CollectionDbRow> {
    const collection = await this.findCollectionInTransaction(tx, rtId, collectionId);
    if (!collection) {
      throw new BadRequestException('Collection lifecycle state changed while processing the request.');
    }
    return collection;
  }

  private assertEditableStatus(status: CollectionStatus): void {
    if (!this.editableCollectionStatuses.includes(status)) {
      throw new BadRequestException('Collection cannot be edited in its current status.');
    }
  }

  private assertSingleStateUpdate(count: number): void {
    if (count !== 1) {
      throw new BadRequestException('Collection lifecycle state changed while processing the request.');
    }
  }

  private toCollectionRecord(collection: CollectionDbRow): CollectionSessionRecord {
    return {
      id: collection.id,
      rtId: collection.rtId,
      scheduleId: collection.scheduleId,
      officerMembershipId: collection.officerMembershipId,
      collectionDate: collection.collectionDate,
      collectionMode: collection.collectionMode,
      status: collection.status,
      note: collection.note,
      totalAmount: collection.totalAmount.toString(),
      submittedAt: collection.submittedAt,
      validatedAt: collection.validatedAt,
      rejectedAt: collection.rejectedAt,
      cancelledAt: collection.cancelledAt,
      validationNote: collection.validationNote,
      rejectionReason: collection.rejectionReason,
      cancellationReason: collection.cancellationReason,
      updatedAt: collection.updatedAt,
      officer: {
        membershipId: collection.officerMembership.id,
        userId: collection.officerMembership.userId,
        fullName: collection.officerMembership.user.fullName,
      },
      route: {
        areaId: collection.schedule?.areaId ?? null,
        areaCode: collection.schedule?.area?.code ?? null,
        areaName: collection.schedule?.area?.name ?? null,
      },
      itemCount: collection._count.items,
    };
  }

  private toChecklist(collection: CollectionSessionRecord, houses: HouseChecklistRow[], items: ItemDbRow[]): CollectionChecklist {
    const itemByHouseId = new Map(items.map((item) => [item.houseId, this.toCollectionItemRecord(item)]));
    return {
      collection,
      houses: houses.map((house) => ({
        houseId: house.id,
        houseNumber: house.houseNumber,
        area: house.area,
        primaryResident: house.residents[0]
          ? {
              id: house.residents[0].id,
              fullName: house.residents[0].fullName,
              defaultJimpitanAmount: house.residents[0].defaultJimpitanAmount.toString(),
            }
          : null,
        item: itemByHouseId.get(house.id) ?? null,
      })),
    };
  }

  private toCollectionItemRecord(item: ItemDbRow): CollectionItemRecord {
    return {
      id: item.id,
      houseId: item.houseId,
      residentId: item.residentId,
      amount: item.amount.toString(),
      status: item.status,
      note: item.note,
      updatedAt: item.updatedAt,
    };
  }

  private toSummary(collection: CollectionSessionRecord, houses: CollectionChecklistHouse[]): CollectionSummary {
    const areaProgress = new Map<string, CollectionAreaProgress>();
    let totalCollected = new Prisma.Decimal(0);
    let completedHouses = 0;
    let paidHouses = 0;
    let outstandingHouses = 0;
    for (const house of houses) {
      const areaKey = house.area.id;
      const progress = areaProgress.get(areaKey) ?? {
        areaId: house.area.id,
        areaCode: house.area.code,
        areaName: house.area.name,
        totalHouses: 0,
        completedHouses: 0,
        paidHouses: 0,
        outstandingHouses: 0,
        totalCollected: '0',
      };
      progress.totalHouses += 1;
      if (house.item) {
        completedHouses += 1;
        progress.completedHouses += 1;
      }
      if (house.item?.status === CollectionItemStatus.PAID) {
        paidHouses += 1;
        progress.paidHouses += 1;
        const amount = new Prisma.Decimal(house.item.amount);
        totalCollected = totalCollected.plus(amount);
        progress.totalCollected = new Prisma.Decimal(progress.totalCollected).plus(amount).toString();
      }
      if (!house.item || !this.settledCollectionItemStatuses.includes(house.item.status)) {
        outstandingHouses += 1;
        progress.outstandingHouses += 1;
      }
      areaProgress.set(areaKey, progress);
    }

    return {
      collectionId: collection.id,
      collectionMode: collection.collectionMode,
      totalCollected: totalCollected.toString(),
      totalHouses: houses.length,
      completedHouses,
      paidHouses,
      outstandingHouses,
      perArea: [...areaProgress.values()].sort((a, b) => a.areaCode.localeCompare(b.areaCode)),
    };
  }

  private toBulkTotalSummary(collection: CollectionSessionRecord): CollectionSummary {
    const perArea =
      collection.route.areaId && collection.route.areaCode && collection.route.areaName
        ? [
            {
              areaId: collection.route.areaId,
              areaCode: collection.route.areaCode,
              areaName: collection.route.areaName,
              totalHouses: 0,
              completedHouses: 0,
              paidHouses: 0,
              outstandingHouses: 0,
              totalCollected: collection.totalAmount,
            },
          ]
        : [];
    return {
      collectionId: collection.id,
      collectionMode: collection.collectionMode,
      totalCollected: collection.totalAmount,
      totalHouses: 0,
      completedHouses: 0,
      paidHouses: 0,
      outstandingHouses: 0,
      perArea,
    };
  }

  private async writeAudit(
    tx: Prisma.TransactionClient,
    input: {
      rtId: string;
      actor: AuthPrincipal;
      meta: JimpitanRequestMeta;
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

  private throwKnownConflict(error: unknown, message: string): never {
    if (error instanceof PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) {
      throw new ConflictException(message);
    }
    throw error;
  }

  private toDate(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
