/**
 * Purpose: Composite hook adapter for jimpitan workflow events.
 * Caller: JimpitanModule JIMPITAN_HOOKS provider binding.
 * Deps: JimpitanFinanceHooks, JimpitanNotificationHooks, and JimpitanHooksPort event contract.
 * MainFuncs: Dispatches collection assignment, submitted, validated, and rejected events to finance and notification hook adapters without coupling JimpitanService to either module.
 * SideEffects: Delegates finance posting and notification writes through injected hook adapters.
 */
import { Injectable } from '@nestjs/common';
import { JimpitanFinanceHooks } from '../../finance/infrastructure/jimpitan-finance.hooks';
import type { CollectionWorkflowEvent } from '../domain/jimpitan.types';
import type { JimpitanHooksPort } from './jimpitan.hooks.port';
import { JimpitanNotificationHooks } from './jimpitan-notification.hooks';

@Injectable()
export class CompositeJimpitanHooks implements JimpitanHooksPort {
  constructor(
    private readonly financeHooks: JimpitanFinanceHooks,
    private readonly notificationHooks: JimpitanNotificationHooks,
  ) {}

  async collectionAssigned(event: CollectionWorkflowEvent): Promise<void> {
    await this.financeHooks.collectionAssigned(event);
    await this.notificationHooks.collectionAssigned(event);
  }

  async collectionSubmitted(event: CollectionWorkflowEvent): Promise<void> {
    await this.financeHooks.collectionSubmitted(event);
    await this.notificationHooks.collectionSubmitted(event);
  }

  async collectionValidated(event: CollectionWorkflowEvent): Promise<void> {
    await this.financeHooks.collectionValidated(event);
    await this.notificationHooks.collectionValidated(event);
  }

  async collectionRejected(event: CollectionWorkflowEvent): Promise<void> {
    await this.financeHooks.collectionRejected(event);
    await this.notificationHooks.collectionRejected(event);
  }
}
