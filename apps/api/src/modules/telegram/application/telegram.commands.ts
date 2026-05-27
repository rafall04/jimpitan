/**
 * Purpose: Command contracts for Telegram webhook, binding-code, and outbox worker workflows.
 * Caller: TelegramController, TelegramService, repository ports, and tests.
 * Deps: Shared AuthPrincipal only.
 * MainFuncs: Defines request metadata and validated Telegram operation inputs.
 * SideEffects: None.
 */
import type { AuthPrincipal } from '../../auth/domain/auth.types';

export type TelegramRequestMeta = {
  webhookSecret?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type CreateTelegramBindCodeCommand = {
  userId?: string;
  membershipId?: string;
  residentId?: string;
  expiresInMinutes?: number;
};

export type CreateTelegramBindCodeInput = {
  codeHash: string;
  expiresAt: Date;
  targetUserId: string;
  targetMembershipId: string;
  targetResidentId?: string;
};

export type ProcessTelegramOutboxCommand = {
  limit?: number;
  staleBefore?: Date;
};

export type TelegramBindingActor = AuthPrincipal;
