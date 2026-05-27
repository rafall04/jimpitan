/**
 * Purpose: Finance-side hook adapter for posting validated jimpitan collections.
 * Caller: JimpitanModule hook binding after collection validation.
 * Deps: FinanceTransactionsService and structural collection workflow event shape.
 * MainFuncs: Converts validated collection workflow events into finance posting requests while keeping the collection module decoupled.
 * SideEffects: Posts validated collections through FinanceTransactionsService.
 */
import { Injectable } from '@nestjs/common';
import type { AuthPrincipal } from '../../auth/domain/auth.types';
import { FinanceTransactionsService } from '../application/finance-transactions.service';

type CollectionWorkflowEventLike = {
  rtId: string;
  collectionId: string;
  actorUserId: string;
  correlationId?: string;
};

@Injectable()
export class JimpitanFinanceHooks {
  constructor(private readonly financeTransactionsService: FinanceTransactionsService) {}

  async collectionAssigned(_event: CollectionWorkflowEventLike): Promise<void> {
    return undefined;
  }

  async collectionSubmitted(_event: CollectionWorkflowEventLike): Promise<void> {
    return undefined;
  }

  async collectionValidated(_event: CollectionWorkflowEventLike): Promise<void> {
    const actor: AuthPrincipal = {
      userId: _event.actorUserId,
      membershipId: 'finance-hook',
      rtId: _event.rtId,
      roles: [],
      permissions: [],
    };
    await this.financeTransactionsService.postValidatedCollection(
      actor,
      {
        collectionId: _event.collectionId,
        idempotencyKey: `collection:${_event.collectionId}`,
      },
      { correlationId: _event.correlationId },
    );
  }

  async collectionRejected(_event: CollectionWorkflowEventLike): Promise<void> {
    return undefined;
  }
}
