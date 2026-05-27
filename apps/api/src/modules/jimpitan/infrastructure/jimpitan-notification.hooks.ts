/**
 * Purpose: Notification hook adapter for jimpitan collection workflow events.
 * Caller: CompositeJimpitanHooks provider after collection submit, validation, and rejection events.
 * Deps: NotificationsService, NotificationChannel enum, AuthPrincipal shape, and JimpitanHooksPort event shape.
 * MainFuncs: Converts collection assignment, submitted, validated, and rejected lifecycle events into tenant-scoped in-app notifications with stable idempotency keys.
 * SideEffects: Writes notifications, outbox events, and notification audit logs through NotificationsService.
 */
import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { NotificationsService } from '../../notifications/application/notifications.service';
import type { CollectionWorkflowEvent } from '../domain/jimpitan.types';
import type { JimpitanHooksPort } from './jimpitan.hooks.port';

@Injectable()
export class JimpitanNotificationHooks implements JimpitanHooksPort {
  constructor(private readonly notificationsService: NotificationsService) {}

  async collectionAssigned(event: CollectionWorkflowEvent): Promise<void> {
    if (!event.officerMembershipId) {
      return undefined;
    }
    await this.notificationsService.createNotifications(
      this.actor(event),
      {
        type: 'COLLECTION_ASSIGNED',
        title: 'Collection assigned',
        body: 'A jimpitan collection has been assigned.',
        channels: [NotificationChannel.IN_APP],
        recipients: [{ membershipId: event.officerMembershipId }],
        payload: { collectionId: event.collectionId, status: event.status },
        idempotencyKey: `collection:${event.collectionId}:assigned:${event.officerMembershipId}`,
        dedupeKey: `collection:${event.collectionId}:assigned:${event.officerMembershipId}`,
      },
      { correlationId: event.correlationId },
    );
  }

  async collectionSubmitted(event: CollectionWorkflowEvent): Promise<void> {
    await this.createCollectionNotification(event, 'COLLECTION_SUBMITTED', 'Collection submitted', 'A jimpitan collection was submitted for validation.', 'submitted');
  }

  async collectionValidated(event: CollectionWorkflowEvent): Promise<void> {
    await this.createCollectionNotification(event, 'COLLECTION_VALIDATED', 'Collection validated', 'A jimpitan collection was validated.', 'validated');
  }

  async collectionRejected(event: CollectionWorkflowEvent): Promise<void> {
    await this.createCollectionNotification(event, 'SYSTEM_ALERT', 'Collection rejected', 'A jimpitan collection was rejected.', 'rejected');
  }

  private async createCollectionNotification(
    event: CollectionWorkflowEvent,
    type: 'COLLECTION_SUBMITTED' | 'COLLECTION_VALIDATED' | 'SYSTEM_ALERT',
    title: string,
    body: string,
    suffix: string,
  ): Promise<void> {
    await this.notificationsService.createNotifications(
      this.actor(event),
      {
        type,
        title,
        body,
        channels: [NotificationChannel.IN_APP],
        recipients: [{ userId: event.actorUserId }],
        payload: { collectionId: event.collectionId, status: event.status },
        idempotencyKey: `collection:${event.collectionId}:${suffix}`,
        dedupeKey: `collection:${event.collectionId}:${suffix}`,
      },
      { correlationId: event.correlationId },
    );
  }

  private actor(event: CollectionWorkflowEvent): AuthPrincipal {
    return {
      userId: event.actorUserId,
      membershipId: 'collection-hook',
      rtId: event.rtId,
      roles: [],
      permissions: [],
    };
  }
}
