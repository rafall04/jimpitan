/**
 * Purpose: Persistence port for per-RT settings (finance visibility).
 * Caller: SettingsService (via SETTINGS_REPOSITORY token); implemented by PrismaSettingsRepository.
 * Deps: Finance visibility domain type.
 * MainFuncs: Declares finance visibility reads (by rtId / rtCode) and writes.
 * SideEffects: None (interface only).
 */
import type { FinanceVisibility } from '../domain/settings.types';

export interface SettingsRepositoryPort {
  getFinanceVisibility(rtId: string): Promise<FinanceVisibility>;
  getFinanceVisibilityByRtCode(rtCode: string): Promise<FinanceVisibility | null>;
  setFinanceVisibility(rtId: string, value: FinanceVisibility, actorUserId: string): Promise<FinanceVisibility>;
}
