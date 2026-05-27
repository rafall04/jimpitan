/**
 * Purpose: Unit tests for frontend environment validation.
 * Caller: Vitest test runner.
 * Deps: Environment parser.
 * MainFuncs: Verifies API URL validation and safe optional app URL handling.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { parseWebEnv } from './env';

describe('parseWebEnv', () => {
  it('accepts explicit API and app URLs without hardcoded defaults', () => {
    expect(parseWebEnv({ NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test', NEXT_PUBLIC_APP_URL: 'https://app.example.test' })).toMatchObject({
      NEXT_PUBLIC_API_BASE_URL: 'https://api.example.test',
      NEXT_PUBLIC_APP_URL: 'https://app.example.test',
    });
  });

  it('rejects missing API URLs when a network client requires them', () => {
    expect(() => parseWebEnv({})).toThrow('NEXT_PUBLIC_API_BASE_URL');
  });
});
