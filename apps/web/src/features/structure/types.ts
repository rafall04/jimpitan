/**
 * Purpose: Frontend Residents/Houses/Areas contract types mirrored from backend DTO responses.
 * Caller: Structure API client, TanStack hooks, forms, pages, and tests.
 * Deps: None.
 * MainFuncs: Defines paginated results, query params, record shapes, form payloads, and status enums.
 * SideEffects: None.
 */
export type SortDirection = 'asc' | 'desc';

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AreaRecord = {
  id: string;
  rtId: string;
  code: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AreaSummary = Pick<AreaRecord, 'id' | 'code' | 'name' | 'sortOrder'>;

export type HouseStatus = 'EMPTY' | 'OCCUPIED' | 'INACTIVE';

export type HouseRecord = {
  id: string;
  rtId: string;
  areaId: string;
  houseNumber: string;
  addressNote: string | null;
  status: HouseStatus;
  area: AreaSummary;
  activeResidentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ResidentStatus = 'ACTIVE' | 'INACTIVE' | 'MOVED';

export type ResidentHouseSummary = {
  id: string;
  houseNumber: string;
  status: HouseStatus;
  area: AreaSummary;
};

export type ResidentListRow = {
  id: string;
  rtId: string;
  houseId: string;
  fullName: string;
  phone: string | null;
  status: ResidentStatus;
  defaultJimpitanAmount: string;
  telegramAccountId: string | null;
  house: ResidentHouseSummary;
  createdAt: string;
  updatedAt: string;
};

export type ResidentRecord = ResidentListRow & {
  notes: string | null;
};

export type AreaListParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: 'code' | 'name' | 'sortOrder' | 'createdAt';
  sortDirection?: SortDirection;
};

export type HouseListParams = {
  page?: number;
  limit?: number;
  search?: string;
  areaId?: string;
  status?: HouseStatus;
  sortBy?: 'houseNumber' | 'areaName' | 'status' | 'createdAt';
  sortDirection?: SortDirection;
};

export type ResidentListParams = {
  page?: number;
  limit?: number;
  search?: string;
  houseId?: string;
  areaId?: string;
  status?: ResidentStatus;
  includeArchived?: boolean;
  sortBy?: 'fullName' | 'houseNumber' | 'areaName' | 'status' | 'createdAt';
  sortDirection?: SortDirection;
};

export type CreateAreaPayload = {
  code: string;
  name: string;
  sortOrder?: number;
};

export type UpdateAreaPayload = Partial<CreateAreaPayload>;

export type CreateHousePayload = {
  areaId: string;
  houseNumber: string;
  addressNote?: string;
  status?: Exclude<HouseStatus, 'INACTIVE'>;
};

export type UpdateHousePayload = {
  areaId?: string;
  houseNumber?: string;
  addressNote?: string | null;
  status?: Exclude<HouseStatus, 'INACTIVE'>;
};

export type CreateResidentPayload = {
  houseId: string;
  fullName: string;
  phone?: string;
  defaultJimpitanAmount?: string;
  notes?: string;
};

export type UpdateResidentPayload = {
  fullName?: string;
  phone?: string | null;
  defaultJimpitanAmount?: string;
  notes?: string | null;
};
