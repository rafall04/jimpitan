/**
 * Purpose: No-op notification delivery hook implementations for Telegram and email channels.
 * Caller: NotificationsModule provider bindings until queue workers and provider integrations are implemented.
 * Deps: Notification delivery ports.
 * MainFuncs: Preserves queue-ready delivery architecture without external Telegram or email API calls.
 * SideEffects: None.
 */
import { Injectable } from '@nestjs/common';
import type { EmailNotificationDeliveryPort, NotificationDeliveryMessage, TelegramNotificationDeliveryPort } from './notification-delivery.port';

@Injectable()
export class NoopTelegramNotificationDelivery implements TelegramNotificationDeliveryPort {
  async enqueueTelegramDelivery(_message: NotificationDeliveryMessage): Promise<void> {
    return undefined;
  }
}

@Injectable()
export class NoopEmailNotificationDelivery implements EmailNotificationDeliveryPort {
  async enqueueEmailDelivery(_message: NotificationDeliveryMessage): Promise<void> {
    return undefined;
  }
}
