/**
 * Purpose: shadcn-compatible textarea primitive for forms.
 * Caller: Content + feature forms.
 * Deps: React, cn utility.
 * MainFuncs: Provides consistent multiline input styling and focus states.
 * SideEffects: None.
 */
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
