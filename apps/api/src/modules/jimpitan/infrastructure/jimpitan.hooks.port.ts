/**
 * Purpose: Hook contract for Telegram-ready and finance-ready jimpitan workflow events.
 * Caller: JimpitanService after transactional collection lifecycle changes.
 * Deps: CollectionWorkflowEvent type.
 * MainFuncs: Defines decoupled assignment, submission, validation, and rejection hooks without implementing Telegram handlers.
 * SideEffects: None in the port.
 */
import type { CollectionWorkflowEvent } from '../domain/jimpitan.types';

export interface JimpitanHooksPort {
  collectionAssigned(event: CollectionWorkflowEvent): Promise<void>;
  collectionSubmitted(event: CollectionWorkflowEvent): Promise<void>;
  collectionValidated(event: CollectionWorkflowEvent): Promise<void>;
  collectionRejected(event: CollectionWorkflowEvent): Promise<void>;
}
