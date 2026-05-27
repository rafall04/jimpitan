/**
 * Purpose: Unit tests for permission-aware dashboard navigation rules.
 * Caller: Vitest test runner.
 * Deps: Navigation helpers and permission constants.
 * MainFuncs: Verifies route gating, public/private separation, and stable tenant-aware paths.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { DASHBOARD_NAV_ITEMS, getAllowedNavigationItems, isRouteAllowed } from './navigation';

describe('dashboard navigation', () => {
  it('keeps private navigation permission-aware and tenant-route stable', () => {
    const allowed = getAllowedNavigationItems(new Set(['residents.read', 'collections.read']), 'rt-1');

    expect(allowed.map((item) => item.href)).toEqual(['/dashboard/residents?rtId=rt-1', '/dashboard/jimpitan?rtId=rt-1']);
    expect(DASHBOARD_NAV_ITEMS.every((item) => item.href.startsWith('/dashboard'))).toBe(true);
  });

  it('allows dashboard shell only when a matching permission exists', () => {
    expect(isRouteAllowed('/dashboard/finance', new Set(['transactions.read']))).toBe(true);
    expect(isRouteAllowed('/dashboard/finance', new Set(['collections.read']))).toBe(false);
    expect(isRouteAllowed('/reports', new Set())).toBe(true);
  });

  it('hides role navigation when the active tenant has no matching permission', () => {
    expect(getAllowedNavigationItems(new Set(['approvals.read']), 'rt-1').map((item) => item.label)).toEqual(['Approvals']);
    expect(getAllowedNavigationItems(new Set(), 'rt-1')).toEqual([]);
  });
});
