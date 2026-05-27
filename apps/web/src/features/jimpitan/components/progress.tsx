/**
 * Purpose: Compact progress and summary widgets for Jimpitan operational screens.
 * Caller: Jimpitan dashboard, session detail, mobile flow, and tests via rendered pages.
 * Deps: Jimpitan workflow formatting helpers and class name utility.
 * MainFuncs: Renders progress bars, metric blocks, and amount summaries without charts.
 * SideEffects: None.
 */
import { cn } from '@/lib/utils/cn';
import { formatCurrencyAmount, getProgressPercent } from '../workflow';

export function ProgressBar({ completed, total, className }: { completed: number; total: number; className?: string }) {
  const percent = getProgressPercent({ completedHouses: completed, totalHouses: total });
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)} aria-label={`${percent}% complete`} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function Metric({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold', accent && 'text-primary')}>{value}</p>
    </div>
  );
}

export function AmountMetric({ label, amount }: { label: string; amount: string }) {
  return <Metric label={label} value={formatCurrencyAmount(amount)} accent />;
}
