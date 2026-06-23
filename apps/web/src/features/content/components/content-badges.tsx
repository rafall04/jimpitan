/**
 * Purpose: Status + type badges for content posts (built on the shared Badge primitive).
 * Caller: Content list and editor pages.
 * Deps: Badge UI primitive, content label maps.
 * MainFuncs: Maps content status/type to a semantic Badge variant.
 * SideEffects: None.
 */
import { Badge } from '@/components/ui/badge';
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS } from '../schemas';
import type { ContentStatus, ContentType } from '../types';

const STATUS_VARIANT: Record<ContentStatus, 'success' | 'gold' | 'secondary'> = {
  DRAFT: 'gold',
  PUBLISHED: 'success',
  ARCHIVED: 'secondary',
};

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{CONTENT_STATUS_LABELS[status]}</Badge>;
}

export function ContentTypeBadge({ type }: { type: ContentType }) {
  return <Badge variant="outline">{CONTENT_TYPE_LABELS[type]}</Badge>;
}
