/**
 * Purpose: Stable dependency injection tokens for notification persistence and delivery hooks.
 * Caller: NotificationsModule, NotificationsService, delivery adapters, and business event hook adapters.
 * Deps: None.
 * MainFuncs: Defines repository, Telegram delivery, and email delivery provider tokens.
 * SideEffects: None.
 */
export const NOTIFICATIONS_REPOSITORY = Symbol('NOTIFICATIONS_REPOSITORY');
export const TELEGRAM_NOTIFICATION_DELIVERY = Symbol('TELEGRAM_NOTIFICATION_DELIVERY');
export const EMAIL_NOTIFICATION_DELIVERY = Symbol('EMAIL_NOTIFICATION_DELIVERY');
