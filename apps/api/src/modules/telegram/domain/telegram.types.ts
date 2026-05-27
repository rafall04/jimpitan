/**
 * Purpose: Domain types for Telegram webhook ingestion, command routing, session state, binding, and outbox delivery.
 * Caller: Telegram service, repository port, sender port, controller DTOs, and unit tests.
 * Deps: AuthPrincipal shared authentication type.
 * MainFuncs: Defines mobile-safe bot context, inbound update, reply, mode-aware Jimpitan session state, binding-code, and outbox records.
 * SideEffects: None.
 */
import type { AuthPrincipal } from '../../auth/domain/auth.types';

export type TelegramUserProfile = {
  telegramUserId: string;
  username: string | null;
  displayName: string | null;
};

export type TelegramAccountRecord = TelegramUserProfile & {
  id: string;
};

export type TelegramInboundUpdate = {
  updateId: string;
  updateType: string;
  chatId: string | null;
  text: string | null;
  callbackData: string | null;
  profile: TelegramUserProfile | null;
  raw: unknown;
};

export type TelegramUpdateRecord = {
  updateId: string;
  isDuplicate: boolean;
};

export type TelegramBotReply = {
  chatId: string;
  text: string;
};

export type TelegramContextRecord = {
  rtId: string;
  rtCode: string;
  rtName: string;
  telegramAccountId: string;
  userId: string;
  membershipId: string;
  roles: string[];
  permissions: string[];
};

export type TelegramResolvedContext = TelegramContextRecord & {
  principal: AuthPrincipal;
};

export type TelegramSessionState =
  | 'IDLE'
  | 'JIMPITAN_SELECT_SESSION'
  | 'JIMPITAN_SELECT_HOUSE'
  | 'JIMPITAN_INPUT_AMOUNT_STATUS'
  | 'JIMPITAN_BULK_TOTAL_AMOUNT'
  | 'JIMPITAN_BULK_TOTAL_NOTE'
  | 'JIMPITAN_NOTE'
  | 'FINANCE_SELECT_CATEGORY'
  | 'FINANCE_AMOUNT'
  | 'FINANCE_DESCRIPTION'
  | 'APPROVAL_ACTION';

export type TelegramSessionRecord = {
  state: TelegramSessionState;
  data: Record<string, unknown>;
  updatedAt?: string;
};

export type TelegramBindingVerificationResult = {
  account: TelegramAccountRecord;
  contexts: TelegramContextRecord[];
};

export type TelegramBindingCodeRecord = {
  code: string;
  expiresAt: Date;
};

export type TelegramOutboxEventRecord = {
  id: string;
  rtId: string;
  notificationId: string;
  telegramAccountId: string;
  title: string;
  body: string;
  payload: unknown;
  attempts: number;
};

export type TelegramWebhookResult = {
  ok: boolean;
  duplicate: boolean;
  replies: TelegramBotReply[];
};

export type TelegramOutboxProcessingResult = {
  processed: number;
  sent: number;
  failed: number;
};
