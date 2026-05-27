/**
 * Purpose: Boundary for Telegram Jimpitan flows that branch by collection mode.
 * Caller: TelegramService /input_jimpitan implementation and Telegram tests.
 * Deps: Telegram session records and Jimpitan collection mode contracts.
 * MainFuncs: Selects PER_HOUSE house-by-house and BULK_TOTAL total-only flow first states.
 * SideEffects: None.
 */
import type { CollectionMode } from '../../jimpitan/domain/collection-mode.types';
import type { TelegramSessionState } from '../domain/telegram.types';

export type TelegramJimpitanModeFlow = {
  collectionMode: CollectionMode;
  firstState: TelegramSessionState;
};

export function getTelegramJimpitanModeFlow(collectionMode: CollectionMode): TelegramJimpitanModeFlow {
  if (collectionMode === 'BULK_TOTAL') {
    return { collectionMode, firstState: 'JIMPITAN_BULK_TOTAL_AMOUNT' };
  }
  return { collectionMode, firstState: 'JIMPITAN_SELECT_HOUSE' };
}
