/**
 * Purpose: Unit tests for safe API URL joining.
 * Caller: Vitest test runner.
 * Deps: URL helper.
 * MainFuncs: Verifies base path preservation and absolute URL rejection.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { joinApiUrl } from './url';

describe('joinApiUrl', () => {
  it('preserves backend base paths when callers pass leading slash paths', () => {
    expect(joinApiUrl('http://localhost:3000/api/v1', '/auth/login').toString()).toBe('http://localhost:3000/api/v1/auth/login');
  });

  it('rejects absolute paths to avoid bypassing configured API origin', () => {
    expect(() => joinApiUrl('http://localhost:3000/api/v1', 'https://evil.example/auth')).toThrow('relative');
    expect(() => joinApiUrl('http://localhost:3000/api/v1', '//evil.example/auth')).toThrow('relative');
  });
});
