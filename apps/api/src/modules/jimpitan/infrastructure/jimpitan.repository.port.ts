/**
 * Purpose: Repository contract for tenant-scoped jimpitan collection persistence.
 * Caller: JimpitanService.
 * Deps: Pagination, AuthPrincipal, jimpitan command contracts, and domain response types.
 * MainFuncs: Defines collection workflow persistence boundaries without exposing Prisma to the application layer.
 * SideEffects: None.
 */
import type { PaginatedResult, PaginationInput } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
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
} from '../application/jimpitan.commands';
import type {
  CollectionAreaRecord,
  CollectionChecklist,
  CollectionSessionRecord,
  CollectionSummary,
  OfficerMembershipRecord,
  OutstandingHouseRecord,
} from '../domain/jimpitan.types';

export interface JimpitanRepositoryPort {
  listCollections(rtId: string, query: CollectionListQuery): Promise<PaginatedResult<CollectionSessionRecord>>;
  findCollectionById(rtId: string, collectionId: string): Promise<CollectionSessionRecord | null>;
  findOfficerMembership(rtId: string, membershipId: string): Promise<OfficerMembershipRecord | null>;
  findArea(rtId: string, areaId: string): Promise<CollectionAreaRecord | null>;
  hasActiveCollectionForRouteDate(rtId: string, input: { collectionDate: string; areaId?: string | null; excludeCollectionId?: string }): Promise<boolean>;
  createCollection(rtId: string, input: CreateCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord>;
  updateCollection(rtId: string, collectionId: string, input: UpdateCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null>;
  startCollection(rtId: string, collectionId: string, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null>;
  cancelCollection(rtId: string, collectionId: string, input: CancelCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null>;
  getChecklist(rtId: string, collectionId: string): Promise<CollectionChecklist | null>;
  generateChecklist(rtId: string, collectionId: string, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionChecklist | null>;
  upsertCollectionItems(rtId: string, collectionId: string, input: UpsertCollectionItemsCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null>;
  setBulkCollectionTotal(rtId: string, collectionId: string, input: SetBulkCollectionTotalCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null>;
  submitCollection(rtId: string, collectionId: string, input: SubmitCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null>;
  validateCollection(rtId: string, collectionId: string, input: ValidateCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null>;
  rejectCollection(rtId: string, collectionId: string, input: RejectCollectionCommand, actor: AuthPrincipal, meta: JimpitanRequestMeta): Promise<CollectionSessionRecord | null>;
  getCollectionSummary(rtId: string, collectionId: string): Promise<CollectionSummary | null>;
  getOutstandingHouses(rtId: string, collectionId: string, pagination: PaginationInput): Promise<PaginatedResult<OutstandingHouseRecord>>;
}
