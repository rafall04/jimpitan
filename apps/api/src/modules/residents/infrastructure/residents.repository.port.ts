/**
 * Purpose: Repository contract for tenant-scoped resident persistence.
 * Caller: ResidentsService.
 * Deps: AuthPrincipal, pagination, resident domain types, and command types.
 * MainFuncs: Defines resident persistence boundaries without exposing Prisma to the application layer.
 * SideEffects: None.
 */
import type { PaginatedResult } from '../../../common/types/paginated-result.type';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { CreateResidentCommand, MoveResidentCommand, ResidentListQuery, ResidentRequestMeta, UpdateResidentCommand } from '../application/residents.commands';
import type { AssignableHouseRecord, ResidentListRow, ResidentRecord, TelegramAccountRecord, TelegramBindingConflict } from '../domain/residents.types';

export interface ResidentsRepositoryPort {
  listResidents(rtId: string, query: ResidentListQuery): Promise<PaginatedResult<ResidentListRow>>;
  findResidentById(rtId: string, residentId: string, options?: { includeArchived?: boolean }): Promise<ResidentRecord | null>;
  findAssignableHouse(rtId: string, houseId: string): Promise<AssignableHouseRecord | null>;
  findTelegramAccount(telegramAccountId: string): Promise<TelegramAccountRecord | null>;
  findConflictingTelegramBinding(rtId: string, telegramAccountId: string, options?: { exceptResidentId?: string }): Promise<TelegramBindingConflict | null>;
  createResident(rtId: string, input: CreateResidentCommand, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord>;
  updateResident(rtId: string, residentId: string, input: UpdateResidentCommand, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord | null>;
  archiveResident(rtId: string, residentId: string, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord | null>;
  reactivateResident(rtId: string, residentId: string, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord | null>;
  moveResident(rtId: string, residentId: string, input: MoveResidentCommand, actor: AuthPrincipal, meta: ResidentRequestMeta): Promise<ResidentRecord | null>;
}
