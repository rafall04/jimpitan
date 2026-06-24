/**
 * Purpose: Render smoke tests for structure status badges and table composition.
 * Caller: Vitest test runner.
 * Deps: React DOM server, DataTable, and status badge components.
 * MainFuncs: Verifies table render output and mobile-safe status labels without a browser.
 * SideEffects: None.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { DataTable } from '@/components/data-table/data-table';
import { HouseStatusBadge, ResidentStatusBadge } from './status-badge';

describe('structure status UI', () => {
  it('renders backend enum labels in status badges', () => {
    expect(renderToStaticMarkup(<ResidentStatusBadge status="MOVED" />)).toContain('Pindah');
    expect(renderToStaticMarkup(<HouseStatusBadge status="INACTIVE" />)).toContain('Diarsipkan');
  });

  it('renders table rows with status content', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={[
          { key: 'name', header: 'Name', cell: (row: { name: string }) => row.name },
          { key: 'status', header: 'Status', cell: () => <ResidentStatusBadge status="ACTIVE" /> },
        ]}
        rows={[{ id: '1', name: 'Budi' }]}
        getRowKey={(row) => row.id}
        emptyTitle="Empty"
        emptyDescription="No rows"
      />,
    );

    expect(html).toContain('Budi');
    expect(html).toContain('Aktif');
  });
});
