/**
 * Purpose: Unit tests for dashboard tenant switcher state helpers.
 * Caller: Vitest test runner.
 * Deps: Tenant selection helpers and session metadata types.
 * MainFuncs: Verifies initial tenant resolution and cross-tenant permission safety.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import type { SessionSnapshot } from '@/features/auth/session-types';
import { isSelectableTenant, resolveActiveTenant, resolveInitialTenantId } from './tenant-selection';

const session: SessionSnapshot = {
  user: { id: 'user-1', name: 'Bendahara', email: 'bendahara@example.test' },
  activeTenantId: 'rt-1',
  tenants: [
    { id: 'membership-1', rtId: 'rt-1', rtCode: 'RT001', rtName: 'RT 001', roleNames: ['BENDAHARA'], permissions: ['transactions.read'], isDefault: true },
    { id: 'membership-2', rtId: 'rt-2', rtCode: 'RT002', rtName: 'RT 002', roleNames: ['PETUGAS'], permissions: [] },
  ],
};

describe('tenant selection', () => {
  it('uses requested tenant only when it belongs to the session', () => {
    expect(resolveInitialTenantId(session, 'rt-2')).toBe('rt-1');
    expect(resolveInitialTenantId(session, 'outside')).toBe('rt-1');
  });

  it('returns the active tenant with its scoped permissions', () => {
    expect(resolveActiveTenant(session, 'rt-1')?.permissions).toEqual(['transactions.read']);
    expect(resolveActiveTenant(session, 'rt-2')?.permissions).toEqual([]);
  });

  it('blocks tenant switch targets that do not have a usable token permission context', () => {
    expect(isSelectableTenant(session, session.tenants[0])).toBe(true);
    expect(isSelectableTenant(session, session.tenants[1])).toBe(false);
  });
});
