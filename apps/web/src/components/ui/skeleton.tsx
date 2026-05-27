/**
 * Purpose: Skeleton loading primitive for placeholder UI.
 * Caller: Loading states, table shells, and future feature pages.
 * Deps: React, HTML attributes, and cn utility.
 * MainFuncs: Provides accessible visual loading blocks without fake content.
 * SideEffects: None.
 */
import type { HTMLAttributes } from 'react';
import React from 'react';
import { cn } from '@/lib/utils/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true" {...props} />;
}
