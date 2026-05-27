/**
 * Purpose: Class name merge helper for shadcn-compatible components.
 * Caller: UI primitives and layout components.
 * Deps: clsx and tailwind-merge.
 * MainFuncs: Merges conditional class names and resolves Tailwind conflicts.
 * SideEffects: None.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
