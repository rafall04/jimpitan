/**
 * Purpose: Unit tests for safe auth redirect normalization.
 * Caller: Vitest test runner.
 * Deps: Redirect helper.
 * MainFuncs: Verifies successful login redirects cannot escape the current app.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { sanitizeRedirectPath } from './redirects';

describe('sanitizeRedirectPath', () => {
  it('keeps safe private relative paths after successful login', () => {
    expect(sanitizeRedirectPath('/dashboard/finance?rtId=rt-1')).toBe('/dashboard/finance?rtId=rt-1');
  });

  it('blocks open redirects and auth/API loops', () => {
    expect(sanitizeRedirectPath('https://evil.example')).toBe('/dashboard');
    expect(sanitizeRedirectPath('//evil.example/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/login')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/api/auth/logout')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/reports')).toBe('/dashboard');
  });
});
