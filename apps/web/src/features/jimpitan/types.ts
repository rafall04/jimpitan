/**
 * Purpose: Frontend Jimpitan collection contract types mirrored from backend responses.
 * Caller: Jimpitan API client, hooks, pages, workflow helpers, and tests.
 * Deps: None.
 * MainFuncs: Defines collection sessions, collection modes, checklist houses, summaries, outstanding rows, and form payload shapes.
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

export type CollectionStatus = 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED' | 'CANCELLED';

export const collectionModes = ['PER_HOUSE', 'BULK_TOTAL', 'HYBRID'] as const;
export const selectableCollectionModes = ['PER_HOUSE', 'BULK_TOTAL'] as const;

export type CollectionMode = (typeof collectionModes)[number];

export type CollectionItemStatus = 'PAID' | 'UNPAID' | 'HOUSE_EMPTY' | 'TITIP_TETANGGA' | 'MENUNGGAK' | 'DISPENSATION';

export type CollectionRouteSummary = {
  areaId: string | null;
  areaCode: string | null;
  areaName: string | null;
};

export type CollectionOfficerSummary = {
  membershipId: string;
  userId: string;
  fullName: string;
};

export type CollectionSessionRecord = {
  id: string;
  rtId: string;
  scheduleId: string | null;
  officerMembershipId: string;
  collectionDate: string;
  collectionMode: CollectionMode;
  status: CollectionStatus;
  note: string | null;
  totalAmount: string;
  submittedAt: string | null;
  validatedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  validationNote: string | null;
  rejectionReason: string | null;
  cancellationReason: string | null;
  updatedAt: string;
  officer: CollectionOfficerSummary;
  route: CollectionRouteSummary;
  itemCount: number;
};

export type CollectionItemRecord = {
  id: string;
  houseId: string;
  residentId: string | null;
  amount: string;
  status: CollectionItemStatus;
  note: string | null;
  updatedAt: string;
};

export type CollectionChecklistHouse = {
  houseId: string;
  houseNumber: string;
  area: {
    id: string;
    code: string;
    name: string;
  };
  primaryResident: {
    id: string;
    fullName: string;
    defaultJimpitanAmount: string;
  } | null;
  item: CollectionItemRecord | null;
};

export type CollectionChecklist = {
  collection: CollectionSessionRecord;
  houses: CollectionChecklistHouse[];
};

export type CollectionAreaProgress = {
  areaId: string;
  areaCode: string;
  areaName: string;
  totalHouses: number;
  completedHouses: number;
  paidHouses: number;
  outstandingHouses: number;
  totalCollected: string;
};

export type CollectionSummary = {
  collectionId: string;
  collectionMode: CollectionMode;
  totalCollected: string;
  totalHouses: number;
  completedHouses: number;
  paidHouses: number;
  outstandingHouses: number;
  perArea: CollectionAreaProgress[];
};

export type OutstandingHouseRecord = CollectionChecklistHouse & {
  outstandingStatus: 'NO_INPUT' | CollectionItemStatus;
};

export type CollectionListParams = {
  page?: number;
  limit?: number;
  status?: CollectionStatus;
  collectionMode?: CollectionMode;
  officerMembershipId?: string;
  areaId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: 'collectionDate' | 'status' | 'updatedAt';
  sortDirection?: SortDirection;
};

export type CreateCollectionPayload = {
  officerMembershipId: string;
  collectionDate: string;
  collectionMode?: CollectionMode;
  totalAmount?: string;
  areaId?: string;
  note?: string;
};

export type SetBulkCollectionTotalPayload = {
  totalAmount: string;
  note?: string | null;
};

export type CollectionItemPayload = {
  houseId: string;
  residentId?: string | null;
  amount: string;
  status: CollectionItemStatus;
  note?: string | null;
};

export type UpsertCollectionItemsPayload = {
  items: CollectionItemPayload[];
};

export type TenantMembershipRow = {
  id: string;
  rtId: string;
  status: string;
  roles: Array<{ id: string; key: string; name: string; rtId: string | null; isSystem: boolean }>;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    status: string;
  };
};
