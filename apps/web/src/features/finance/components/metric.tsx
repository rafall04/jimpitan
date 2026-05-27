/**
 * Purpose: Compact finance metric widgets for balance, totals, and queue counts.
 * Caller: Finance dashboard and detail pages.
 * Deps: Currency formatter.
 * MainFuncs: Renders numeric and money metrics without client-side financial aggregation.
 * SideEffects: None.
 */
import { formatCurrencyAmount } from '../workflow';

export function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function AmountMetric({ label, amount, detail }: { label: string; amount: string; detail?: string }) {
  return <Metric label={label} value={formatCurrencyAmount(amount)} detail={detail} />;
}
