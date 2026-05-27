/**
 * Purpose: Unit tests for tenant-scoped TanStack Query key factories.
 * Caller: Vitest test runner.
 * Deps: Query key helpers.
 * MainFuncs: Verifies query keys always include tenant scope for private resources.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { queryKeys } from './query-keys';

describe('queryKeys', () => {
  it('includes rtId in every private resource query key', () => {
    expect(queryKeys.residents.list('rt-1', { page: 1 })).toEqual(['rt', 'rt-1', 'residents', 'list', { page: 1 }]);
    expect(queryKeys.finance.summary('rt-1')).toEqual(['rt', 'rt-1', 'finance', 'summary']);
    expect(queryKeys.notifications.unread('rt-1')).toEqual(['rt', 'rt-1', 'notifications', 'unread']);
  });

  it('keeps public report keys separate from private tenant keys', () => {
    expect(queryKeys.publicReports.summary('RT001')).toEqual(['public', 'reports', 'RT001', 'summary']);
    expect(queryKeys.publicReports.monthly('RT001', '2026-05')).toEqual(['public', 'reports', 'RT001', 'monthly', '2026-05']);
    expect(queryKeys.publicReports.metadata('RT001', { limit: 5 })).toEqual(['public', 'reports', 'RT001', 'metadata', { limit: 5 }]);
    expect(queryKeys.publicReports.announcements('RT001', { search: 'iuran' })).toEqual(['public', 'reports', 'RT001', 'announcements', { search: 'iuran' }]);
  });
});
