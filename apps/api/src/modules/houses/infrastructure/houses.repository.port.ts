/**
 * Purpose: Repository contract for tenant-scoped area and house persistence.
 * Caller: AreasService and HousesService.
 * Deps: AuthPrincipal, pagination, domain types, and command types.
 * MainFuncs: Defines physical-structure persistence boundaries without exposing Prisma to application services.
 * SideEffects: None.
 */
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

export interface HousesRepositoryPort {
  listAreas(rtId: string, query: AreaListQuery): Promise<PaginatedResult<AreaRecord>>;
  findAreaById(rtId: string, areaId: string): Promise<AreaRecord | null>;
  createArea(rtId: string, input: CreateAreaCommand, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<AreaRecord>;
  updateArea(rtId: string, areaId: string, input: UpdateAreaCommand, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<AreaRecord | null>;
  archiveArea(rtId: string, areaId: string, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<AreaRecord | null>;
  countActiveHousesInArea(rtId: string, areaId: string): Promise<number>;

  listHouses(rtId: string, query: HouseListQuery): Promise<PaginatedResult<HouseRecord>>;
  findHouseById(rtId: string, houseId: string): Promise<HouseRecord | null>;
  createHouse(rtId: string, input: CreateHouseCommand, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<HouseRecord>;
  updateHouse(rtId: string, houseId: string, input: UpdateHouseCommand, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<HouseRecord | null>;
  archiveHouse(rtId: string, houseId: string, actor: AuthPrincipal, meta: StructureRequestMeta): Promise<HouseRecord | null>;
  countActiveResidentsInHouse(rtId: string, houseId: string): Promise<number>;
}
