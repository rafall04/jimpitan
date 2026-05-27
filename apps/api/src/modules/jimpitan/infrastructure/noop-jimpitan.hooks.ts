/**
 * Purpose: No-op implementation of jimpitan workflow hooks.
 * Caller: Tests or fallback dependency injection when composite notification and finance hooks are not bound.
 * Deps: JimpitanHooksPort and collection workflow event type.
 * MainFuncs: Keeps collection assignment and lifecycle workflow decoupled when real subscribers are intentionally absent.
 * SideEffects: None.
 */
import { Injectable } from '@nestjs/common';
import type { CollectionWorkflowEvent } from '../domain/jimpitan.types';
import type { JimpitanHooksPort } from './jimpitan.hooks.port';

@Injectable()
export class NoopJimpitanHooks implements JimpitanHooksPort {
  async collectionAssigned(_event: CollectionWorkflowEvent): Promise<void> {
    return undefined;
  }

  async collectionSubmitted(_event: CollectionWorkflowEvent): Promise<void> {
    return undefined;
  }

  async collectionValidated(_event: CollectionWorkflowEvent): Promise<void> {
    return undefined;
  }

  async collectionRejected(_event: CollectionWorkflowEvent): Promise<void> {
    return undefined;
  }
}
