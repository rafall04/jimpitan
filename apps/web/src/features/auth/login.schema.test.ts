/**
 * Purpose: Unit tests for frontend login validation.
 * Caller: Vitest test runner.
 * Deps: Login schema.
 * MainFuncs: Verifies credential validation and optional RT context handling.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { loginFormSchema } from './login.schema';

describe('loginFormSchema', () => {
  it('accepts credentials with optional RT context', () => {
    const parsed = loginFormSchema.parse({
      identifier: 'bendahara@example.test',
      password: 'password-1',
      rtId: '11111111-1111-4111-8111-111111111111',
    });

    expect(parsed.identifier).toBe('bendahara@example.test');
    expect(parsed.rtId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('rejects short credentials before calling auth APIs', () => {
    expect(() => loginFormSchema.parse({ identifier: 'ab', password: 'short' })).toThrow();
  });
});
