/**
 * Purpose: Unit tests for same-origin auth request validation.
 * Caller: Vitest test runner.
 * Deps: CSRF helper.
 * MainFuncs: Verifies cross-site rejection, same-origin allowance, and metadata-less default-deny.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { isSameOriginHeaderSet } from './csrf.server';

describe('isSameOriginHeaderSet', () => {
  it('allows same-origin requests by host match', () => {
    expect(isSameOriginHeaderSet({ origin: 'https://rt.example.test', host: 'rt.example.test' })).toBe(true);
  });

  it('rejects cross-origin browser requests', () => {
    expect(isSameOriginHeaderSet({ origin: 'https://evil.example', host: 'rt.example.test' })).toBe(false);
    expect(isSameOriginHeaderSet({ secFetchSite: 'cross-site', host: 'rt.example.test' })).toBe(false);
  });

  it('rejects requests with neither origin nor fetch-metadata (default-deny)', () => {
    expect(isSameOriginHeaderSet({ host: 'rt.example.test' })).toBe(false);
  });
});
