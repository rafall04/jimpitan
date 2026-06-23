/**
 * Purpose: Status/label badge primitive with semantic variants.
 * Caller: Content status/type chips, lists, and detail headers.
 * Deps: class-variance-authority, cn utility.
 * MainFuncs: Renders a pill badge in primary/secondary/success/gold/destructive/outline/solid styles.
 * SideEffects: None.
 */
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-primary/10 text-primary',
      secondary: 'bg-secondary text-secondary-foreground',
      success: 'bg-success/12 text-success',
      gold: 'bg-gold-soft text-gold-soft-foreground',
      destructive: 'bg-destructive/10 text-destructive',
      outline: 'border text-muted-foreground',
      solid: 'bg-primary text-primary-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
