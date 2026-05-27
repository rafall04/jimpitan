/**
 * Purpose: Stable dependency injection tokens for Telegram bot persistence and delivery adapters.
 * Caller: TelegramModule, TelegramService, repositories, and sender adapters.
 * Deps: None.
 * MainFuncs: Defines Telegram repository and sender provider tokens.
 * SideEffects: None.
 */
export const TELEGRAM_REPOSITORY = Symbol('TELEGRAM_REPOSITORY');
export const TELEGRAM_SENDER = Symbol('TELEGRAM_SENDER');
