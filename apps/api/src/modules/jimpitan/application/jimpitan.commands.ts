/**
 * Purpose: Command and query contracts for jimpitan collection workflows.
 * Caller: JimpitanController, JimpitanService, repository ports, and hooks.
 * Deps: Prisma enum types and shared pagination type.
 * MainFuncs: Defines mode-aware collection workflow inputs and audit request metadata.
 * SideEffects: None.
 */
import type { CollectionStatus } from '@prisma/client';
import type { PaginationInput } from '../../../common/types/paginated-result.type';
import type { CollectionMode } from '../domain/collection-mode.types';
import type { CollectionItemInputStatus } from '../domain/jimpitan.types';

export type JimpitanRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type SortDirection = 'asc' | 'desc';

export type CollectionSortField = 'collectionDate' | 'status' | 'updatedAt';

export type CollectionListQuery = PaginationInput & {
  status?: CollectionStatus;
  collectionMode?: CollectionMode;
  officerMembershipId?: string;
  areaId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: CollectionSortField;
  sortDirection?: SortDirection;
};

export type CreateCollectionCommand = {
  officerMembershipId: string;
  collectionDate: string;
  collectionMode?: CollectionMode;
  totalAmount?: string;
  areaId?: string;
  note?: string;
};

export type UpdateCollectionCommand = {
  officerMembershipId?: string;
  collectionDate?: string;
  collectionMode?: CollectionMode;
  totalAmount?: string | null;
  areaId?: string | null;
  note?: string | null;
};

export type SetBulkCollectionTotalCommand = {
  totalAmount: string;
  note?: string | null;
};

export type CollectionItemCommand = {
  houseId: string;
  residentId?: string | null;
  amount: string;
  status: CollectionItemInputStatus;
  note?: string | null;
};

export type UpsertCollectionItemsCommand = {
  items: CollectionItemCommand[];
};

export type SubmitCollectionCommand = {
  submitRequestId?: string;
};

export type ValidateCollectionCommand = {
  validationNote?: string;
};

export type RejectCollectionCommand = {
  rejectionReason: string;
};

export type CancelCollectionCommand = {
  cancellationReason: string;
};
