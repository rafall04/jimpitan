/**
 * Purpose: Generic accessible table foundation.
 * Caller: Future list pages for residents, collections, finance, approvals, and reports.
 * Deps: ReactNode and cn utility.
 * MainFuncs: Renders columns, rows, empty state, and stable responsive overflow without feature-specific logic.
 * SideEffects: None.
 */
import React, { type ReactNode } from 'react';
import { EmptyState } from '@/components/feedback/empty-state';
import { cn } from '@/lib/utils/cn';

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon}>
        {emptyAction}
      </EmptyState>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={cn('px-4 py-3 font-medium text-muted-foreground', column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)} className="border-t">
              {columns.map((column) => (
                <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
