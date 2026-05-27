/**
 * Purpose: Delivery hook contracts for queue-ready notification dispatch adapters.
 * Caller: Future outbox workers, Telegram delivery adapter, email delivery adapter, and NotificationsModule provider bindings.
 * Deps: Prisma notification channel enum.
 * MainFuncs: Defines delivery message shape plus Telegram and email delivery ports without provider integrations.
 * SideEffects: None in the port.
 */
import type { NotificationChannel } from '@prisma/client';

export type NotificationDeliveryMessage = {
  notificationId: string;
  rtId: string;
  channel: NotificationChannel;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  recipientUserId?: string;
  recipientResidentId?: string;
  telegramAccountId?: string;
};

export interface TelegramNotificationDeliveryPort {
  enqueueTelegramDelivery(message: NotificationDeliveryMessage): Promise<void>;
}

export interface EmailNotificationDeliveryPort {
  enqueueEmailDelivery(message: NotificationDeliveryMessage): Promise<void>;
}
