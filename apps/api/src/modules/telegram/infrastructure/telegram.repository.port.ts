/**
 * Purpose: Persistence boundary for Telegram bot ingestion, binding, sessions, audit, and outbox delivery.
 * Caller: TelegramService and PrismaTelegramRepository.
 * Deps: Telegram domain types and command contracts.
 * MainFuncs: Defines repository operations with tenant-scoped context and retry-safe outbox mutation contracts.
 * SideEffects: None in the port.
 */
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import type { CreateTelegramBindCodeInput, TelegramRequestMeta } from '../application/telegram.commands';
import type {
  TelegramAccountRecord,
  TelegramBindingVerificationResult,
  TelegramContextRecord,
  TelegramInboundUpdate,
  TelegramOutboxEventRecord,
  TelegramSessionRecord,
  TelegramUpdateRecord,
  TelegramUserProfile,
} from '../domain/telegram.types';

export interface TelegramRepositoryPort {
  upsertAccount(profile: TelegramUserProfile): Promise<TelegramAccountRecord>;
  recordIncomingUpdate(update: TelegramInboundUpdate, telegramAccountId: string | null): Promise<TelegramUpdateRecord>;
  markUpdateProcessed(updateId: string, context: { rtId?: string; telegramAccountId?: string | null }): Promise<void>;
  markUpdateFailed(updateId: string, errorMessage: string, context: { rtId?: string; telegramAccountId?: string | null }): Promise<void>;
  getVerifiedContexts(telegramAccountId: string): Promise<TelegramContextRecord[]>;
  verifyBindingCode(codeHash: string, account: TelegramAccountRecord, meta: TelegramRequestMeta): Promise<TelegramBindingVerificationResult | null>;
  createBindingCode(rtId: string, input: CreateTelegramBindCodeInput, actor: AuthPrincipal, meta: TelegramRequestMeta): Promise<void>;
  getLatestSession(telegramAccountId: string, rtIds: string[]): Promise<{ rtId: string; session: TelegramSessionRecord } | null>;
  saveSession(rtId: string, telegramAccountId: string, userId: string, session: TelegramSessionRecord): Promise<void>;
  clearSession(rtId: string, telegramAccountId: string, userId: string): Promise<void>;
  recoverStaleTelegramOutbox(staleBefore: Date): Promise<number>;
  claimPendingTelegramOutbox(limit: number): Promise<TelegramOutboxEventRecord[]>;
  findChatForTelegramAccount(rtId: string, telegramAccountId: string): Promise<string | null>;
  completeTelegramOutbox(outboxEventId: string, notificationId: string): Promise<void>;
  failTelegramOutbox(outboxEventId: string, notificationId: string, failureReason: string): Promise<void>;
}
