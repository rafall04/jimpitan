/**
 * Purpose: Accessible form label primitive.
 * Caller: Auth forms and future feature forms.
 * Deps: React and cn utility.
 * MainFuncs: Provides consistent label typography and disabled state styling.
 * SideEffects: None.
 */
import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return <label className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)} {...props} />;
}
