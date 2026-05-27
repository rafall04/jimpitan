/**
 * Purpose: Command and query contracts for house and area management use cases.
 * Caller: Houses and areas controllers, services, and repository ports.
 * Deps: Prisma enum types and shared pagination type.
 * MainFuncs: Defines validated command shapes plus audit request metadata.
 * SideEffects: None.
 */
import type { HouseStatus } from '@prisma/client';
import type { PaginationInput } from '../../../common/types/paginated-result.type';

export type StructureRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type SortDirection = 'asc' | 'desc';

export type AreaSortField = 'code' | 'name' | 'sortOrder' | 'createdAt';

export type AreaListQuery = PaginationInput & {
  search?: string;
  isActive?: boolean;
  sortBy?: AreaSortField;
  sortDirection?: SortDirection;
};

export type CreateAreaCommand = {
  code: string;
  name: string;
  sortOrder?: number;
};

export type UpdateAreaCommand = {
  code?: string;
  name?: string;
  sortOrder?: number;
};

export type HouseSortField = 'houseNumber' | 'areaName' | 'status' | 'createdAt';

export type HouseListQuery = PaginationInput & {
  search?: string;
  areaId?: string;
  status?: HouseStatus;
  sortBy?: HouseSortField;
  sortDirection?: SortDirection;
};

export type CreateHouseCommand = {
  areaId: string;
  houseNumber: string;
  addressNote?: string;
  status?: HouseStatus;
};

export type UpdateHouseCommand = {
  areaId?: string;
  houseNumber?: string;
  addressNote?: string | null;
  status?: HouseStatus;
};
