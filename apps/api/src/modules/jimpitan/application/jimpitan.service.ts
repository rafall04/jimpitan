/**
 * Purpose: Application service for tenant-scoped jimpitan collection workflows.
 * Caller: JimpitanController and unit tests.
 * Deps: Jimpitan repository port, workflow hook port, AuthPrincipal, and collection command contracts.
 * MainFuncs: Enforces tenant scope, collection mode rules, lifecycle rules, officer ownership, duplicate prevention, assignment hooks, and lifecycle hook dispatch.
 * SideEffects: Writes collection data and audit logs through the repository and dispatches finance/notification-ready hooks.
 */
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CollectionStatus } from '@prisma/client';
import type { PaginatedResult, PaginationInput } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { JIMPITAN_HOOKS, JIMPITAN_REPOSITORY } from '../jimpitan.tokens';
import type {
  CancelCollectionCommand,
  CollectionListQuery,
  CreateCollectionCommand,
  JimpitanRequestMeta,
  RejectCollectionCommand,
  SetBulkCollectionTotalCommand,
  SubmitCollectionCommand,
  UpdateCollectionCommand,
  UpsertCollectionItemsCommand,
  ValidateCollectionCommand,
} from './jimpitan.commands';
import { assertBulkTotalAmount, assertCollectionModeSubmissionReady, assertPerHouseItemsAllowed } from './collection-mode.policy';
import { DEFAULT_COLLECTION_MODE } from '../domain/collection-mode.types';
import type { CollectionChecklist, CollectionSessionRecord, CollectionSummary, OutstandingHouseRecord } from '../domain/jimpitan.types';
import type { JimpitanHooksPort } from '../infrastructure/jimpitan.hooks.port';
import type { JimpitanRepositoryPort } from '../infrastructure/jimpitan.repository.port';

@Injectable()
export class JimpitanService {
  private readonly editableStatuses = new Set<CollectionStatus>([CollectionStatus.DRAFT, CollectionStatus.IN_PROGRESS, CollectionStatus.REJECTED]);

  constructor(
    @Inject(JIMPITAN_REPOSITORY) private readonly repository: JimpitanRepositoryPort,
    @Inject(JIMPITAN_HOOKS) private readonly hooks: JimpitanHooksPort,
  ) {}

  async listCollections(actor: AuthPrincipal, query: CollectionListQuery): Promise<PaginatedResult<CollectionSessionRecord>> {
    return this.repository.listCollections(actor.rtId, query);
  }

  async listMyMobileCollections(actor: AuthPrincipal, query: CollectionListQuery): Promise<PaginatedResult<CollectionSessionRecord>> {
    return this.repository.listCollections(actor.rtId, {
      ...query,
      officerMembershipId: actor.membershipId,
    });
  }

  async getCollection(actor: AuthPrincipal, collectionId: string): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanReadCollection(actor, collection);
    return collection;
  }

  async createCollection(actor: AuthPrincipal, command: CreateCollectionCommand, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    this.assertModeInput(command.collectionMode ?? DEFAULT_COLLECTION_MODE, command.totalAmount);
    await this.assertOfficerAssignable(actor.rtId, command.officerMembershipId);
    await this.assertAreaAssignable(actor.rtId, command.areaId);
    await this.assertNoActiveDuplicate(actor.rtId, command.collectionDate, command.areaId ?? null);
    const created = await this.repository.createCollection(actor.rtId, command, actor, meta);
    await this.hooks.collectionAssigned(this.toWorkflowEvent(created, actor, meta));
    return created;
  }

  async updateCollection(actor: AuthPrincipal, collectionId: string, command: UpdateCollectionCommand, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCollectionEditable(collection);
    this.assertModeChangeAllowed(collection, command);
    if (command.officerMembershipId) {
      await this.assertOfficerAssignable(actor.rtId, command.officerMembershipId);
    }
    if (command.areaId !== undefined && command.areaId !== null) {
      await this.assertAreaAssignable(actor.rtId, command.areaId);
    }
    if (command.collectionDate || command.areaId !== undefined) {
      await this.assertNoActiveDuplicate(actor.rtId, command.collectionDate ?? this.toDateOnly(collection.collectionDate), command.areaId ?? collection.route.areaId, collectionId);
    }

    const updated = await this.repository.updateCollection(actor.rtId, collectionId, command, actor, meta);
    if (!updated) {
      throw new NotFoundException('Collection was not found.');
    }
    if (command.officerMembershipId && command.officerMembershipId !== collection.officerMembershipId) {
      await this.hooks.collectionAssigned(this.toWorkflowEvent(updated, actor, meta));
    }
    return updated;
  }

  async startCollection(actor: AuthPrincipal, collectionId: string, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanMutateOwnCollection(actor, collection);
    this.assertCollectionEditable(collection);
    const started = await this.repository.startCollection(actor.rtId, collectionId, actor, meta);
    if (!started) {
      throw new NotFoundException('Collection was not found.');
    }
    return started;
  }

  async cancelCollection(actor: AuthPrincipal, collectionId: string, command: CancelCollectionCommand, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    if (collection.status === CollectionStatus.VALIDATED) {
      throw new BadRequestException('Validated collections cannot be cancelled.');
    }
    const cancelled = await this.repository.cancelCollection(actor.rtId, collectionId, command, actor, meta);
    if (!cancelled) {
      throw new NotFoundException('Collection was not found.');
    }
    return cancelled;
  }

  async getChecklist(actor: AuthPrincipal, collectionId: string): Promise<CollectionChecklist> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanReadCollection(actor, collection);
    const checklist = await this.repository.getChecklist(actor.rtId, collectionId);
    if (!checklist) {
      throw new NotFoundException('Collection was not found.');
    }
    return checklist;
  }

  async generateChecklist(actor: AuthPrincipal, collectionId: string, meta: JimpitanRequestMeta): Promise<CollectionChecklist> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanMutateOwnCollection(actor, collection);
    this.assertCollectionEditable(collection);
    assertPerHouseItemsAllowed(collection.collectionMode);
    const checklist = await this.repository.generateChecklist(actor.rtId, collectionId, actor, meta);
    if (!checklist) {
      throw new NotFoundException('Collection was not found.');
    }
    return checklist;
  }

  async upsertCollectionItems(actor: AuthPrincipal, collectionId: string, command: UpsertCollectionItemsCommand, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanMutateOwnCollection(actor, collection);
    this.assertCollectionEditable(collection);
    assertPerHouseItemsAllowed(collection.collectionMode);
    this.assertNoDuplicateHouseItems(command);
    this.assertValidItemAmounts(command);
    const updated = await this.repository.upsertCollectionItems(actor.rtId, collectionId, command, actor, meta);
    if (!updated) {
      throw new NotFoundException('Collection was not found.');
    }
    return updated;
  }

  async setBulkCollectionTotal(actor: AuthPrincipal, collectionId: string, command: SetBulkCollectionTotalCommand, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanMutateOwnCollection(actor, collection);
    this.assertCollectionEditable(collection);
    if (collection.collectionMode !== 'BULK_TOTAL') {
      throw new BadRequestException('Only BULK_TOTAL collections accept session total input.');
    }
    assertBulkTotalAmount({ collectionMode: collection.collectionMode, totalAmount: command.totalAmount });
    const updated = await this.repository.setBulkCollectionTotal(actor.rtId, collectionId, command, actor, meta);
    if (!updated) {
      throw new NotFoundException('Collection was not found.');
    }
    return updated;
  }

  async submitCollection(actor: AuthPrincipal, collectionId: string, command: SubmitCollectionCommand, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanSubmitCollection(actor, collection);
    this.assertCollectionEditable(collection);
    assertCollectionModeSubmissionReady({
      collectionId,
      collectionMode: collection.collectionMode,
      totalAmount: collection.totalAmount,
      itemCount: collection.itemCount,
    });
    const submitted = await this.repository.submitCollection(actor.rtId, collectionId, command, actor, meta);
    if (!submitted) {
      throw new NotFoundException('Collection was not found.');
    }
    await this.hooks.collectionSubmitted(this.toWorkflowEvent(submitted, actor, meta));
    return submitted;
  }

  async validateCollection(actor: AuthPrincipal, collectionId: string, command: ValidateCollectionCommand, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    if (collection.status !== CollectionStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted collections can be validated.');
    }
    assertCollectionModeSubmissionReady({
      collectionId,
      collectionMode: collection.collectionMode,
      totalAmount: collection.totalAmount,
      itemCount: collection.itemCount,
    });
    const validated = await this.repository.validateCollection(actor.rtId, collectionId, command, actor, meta);
    if (!validated) {
      throw new NotFoundException('Collection was not found.');
    }
    await this.hooks.collectionValidated(this.toWorkflowEvent(validated, actor, meta));
    return validated;
  }

  async rejectCollection(actor: AuthPrincipal, collectionId: string, command: RejectCollectionCommand, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    if (collection.status !== CollectionStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted collections can be rejected.');
    }
    const rejected = await this.repository.rejectCollection(actor.rtId, collectionId, command, actor, meta);
    if (!rejected) {
      throw new NotFoundException('Collection was not found.');
    }
    await this.hooks.collectionRejected(this.toWorkflowEvent(rejected, actor, meta));
    return rejected;
  }

  async getSummary(actor: AuthPrincipal, collectionId: string): Promise<CollectionSummary> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanReadCollection(actor, collection);
    const summary = await this.repository.getCollectionSummary(actor.rtId, collectionId);
    if (!summary) {
      throw new NotFoundException('Collection was not found.');
    }
    return summary;
  }

  async getOutstandingHouses(actor: AuthPrincipal, collectionId: string, pagination: PaginationInput): Promise<PaginatedResult<OutstandingHouseRecord>> {
    const collection = await this.getCollectionOrThrow(actor.rtId, collectionId);
    this.assertCanReadCollection(actor, collection);
    if (collection.collectionMode === 'BULK_TOTAL') {
      return { items: [], page: pagination.page, limit: pagination.limit, total: 0, totalPages: 0 };
    }
    return this.repository.getOutstandingHouses(actor.rtId, collectionId, pagination);
  }

  private async getCollectionOrThrow(rtId: string, collectionId: string): Promise<CollectionSessionRecord> {
    const collection = await this.repository.findCollectionById(rtId, collectionId);
    if (!collection) {
      throw new NotFoundException('Collection was not found.');
    }
    return collection;
  }

  private async assertOfficerAssignable(rtId: string, membershipId: string): Promise<void> {
    const officer = await this.repository.findOfficerMembership(rtId, membershipId);
    if (!officer) {
      throw new NotFoundException('Officer membership was not found.');
    }
  }

  private async assertAreaAssignable(rtId: string, areaId?: string): Promise<void> {
    if (!areaId) {
      return;
    }
    const area = await this.repository.findArea(rtId, areaId);
    if (!area) {
      throw new NotFoundException('Area was not found.');
    }
    if (!area.isActive) {
      throw new BadRequestException('Archived areas cannot be assigned to collections.');
    }
  }

  private async assertNoActiveDuplicate(rtId: string, collectionDate: string, areaId?: string | null, excludeCollectionId?: string): Promise<void> {
    const hasDuplicate = await this.repository.hasActiveCollectionForRouteDate(rtId, { collectionDate, areaId, excludeCollectionId });
    if (hasDuplicate) {
      throw new BadRequestException('An active collection already exists for this route and date.');
    }
  }

  private assertCollectionEditable(collection: CollectionSessionRecord): void {
    if (!this.editableStatuses.has(collection.status)) {
      throw new BadRequestException('Collection cannot be edited in its current status.');
    }
  }

  private assertModeInput(collectionMode: CollectionSessionRecord['collectionMode'], totalAmount?: string | null): void {
    if (collectionMode === 'BULK_TOTAL' && totalAmount) {
      assertBulkTotalAmount({ collectionMode, totalAmount });
    }
    if (collectionMode === 'PER_HOUSE' && totalAmount) {
      throw new BadRequestException('PER_HOUSE collections calculate totals from house items.');
    }
    if (collectionMode === 'HYBRID') {
      throw new BadRequestException('HYBRID collection mode is reserved for future rollout.');
    }
  }

  private assertModeChangeAllowed(collection: CollectionSessionRecord, command: UpdateCollectionCommand): void {
    const nextMode = command.collectionMode ?? collection.collectionMode;
    this.assertModeInput(nextMode, command.totalAmount ?? undefined);
    if (command.collectionMode && command.collectionMode !== collection.collectionMode && collection.itemCount > 0) {
      throw new BadRequestException('Collection mode cannot be changed after collection items exist.');
    }
  }

  private assertCanReadCollection(actor: AuthPrincipal, collection: CollectionSessionRecord): void {
    if (actor.permissions.includes('collections.read') || actor.membershipId === collection.officerMembershipId) {
      return;
    }
    throw new ForbiddenException('Collection access is not allowed.');
  }

  private assertCanMutateOwnCollection(actor: AuthPrincipal, collection: CollectionSessionRecord): void {
    if (actor.permissions.includes('collections.validate') || actor.membershipId === collection.officerMembershipId) {
      return;
    }
    throw new ForbiddenException('Collection mutation is not allowed.');
  }

  private assertCanSubmitCollection(actor: AuthPrincipal, collection: CollectionSessionRecord): void {
    if (actor.permissions.includes('collections.validate') || actor.membershipId === collection.officerMembershipId) {
      return;
    }
    throw new ForbiddenException('Collection submission is not allowed.');
  }

  private assertNoDuplicateHouseItems(command: UpsertCollectionItemsCommand): void {
    const houseIds = command.items.map((item) => item.houseId);
    if (new Set(houseIds).size !== houseIds.length) {
      throw new BadRequestException('Duplicate house entries are not allowed in one batch.');
    }
  }

  private assertValidItemAmounts(command: UpsertCollectionItemsCommand): void {
    for (const item of command.items) {
      const amount = Number(item.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new BadRequestException('Collection item amount must be a non-negative number.');
      }
      if (item.status === 'PAID' && amount <= 0) {
        throw new BadRequestException('Paid collection items require an amount greater than zero.');
      }
      if (item.status !== 'PAID' && amount > 0) {
        throw new BadRequestException('Only paid collection items can carry a collected amount.');
      }
    }
  }

  private toWorkflowEvent(collection: CollectionSessionRecord, actor: AuthPrincipal, meta: JimpitanRequestMeta) {
    return {
      rtId: collection.rtId,
      collectionId: collection.id,
      collectionMode: collection.collectionMode,
      status: collection.status,
      officerMembershipId: collection.officerMembershipId,
      actorUserId: actor.userId,
      correlationId: meta.correlationId,
    };
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
