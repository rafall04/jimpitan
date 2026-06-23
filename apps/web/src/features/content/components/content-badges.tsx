/**
 * Purpose: Small status + type badges for content posts.
 * Caller: Content list and editor pages.
 * Deps: content label maps, cn utility.
 * MainFuncs: Renders an accessible colored status pill and a type pill.
 * SideEffects: None.
 */
import { cn } from '@/lib/utils/cn';
import { CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS } from '../schemas';
import type { ContentStatus, ContentType } from '../types';

const STATUS_STYLES: Record<ContentStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  ARCHIVED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_STYLES[status])}>{CONTENT_STATUS_LABELS[status]}</span>;
}

export function ContentTypeBadge({ type }: { type: ContentType }) {
  return <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{CONTENT_TYPE_LABELS[type]}</span>;
}
