/**
 * Purpose: Command and query contracts for resident management use cases.
 * Caller: ResidentsController, ResidentsService, and repository ports.
 * Deps: Shared pagination type.
 * MainFuncs: Defines validated resident command shapes plus audit request metadata.
 * SideEffects: None.
 */
import type { PaginationInput } from '../../../common/types/paginated-result.type';

export type ResidentRequestMeta = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type SortDirection = 'asc' | 'desc';

export type ResidentSortField = 'fullName' | 'houseNumber' | 'areaName' | 'status' | 'createdAt';

export type ResidentListQuery = PaginationInput & {
  search?: string;
  houseId?: string;
  areaId?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'MOVED';
  includeArchived?: boolean;
  sortBy?: ResidentSortField;
  sortDirection?: SortDirection;
};

export type CreateResidentCommand = {
  houseId: string;
  fullName: string;
  phone?: string;
  defaultJimpitanAmount?: string;
  notes?: string;
  telegramAccountId?: string;
};

export type UpdateResidentCommand = {
  fullName?: string;
  phone?: string | null;
  defaultJimpitanAmount?: string;
  notes?: string | null;
  telegramAccountId?: string | null;
};

export type MoveResidentCommand = {
  houseId: string;
};
