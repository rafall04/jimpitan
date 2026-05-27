/**
 * Purpose: Unit tests for safe structure API error message formatting.
 * Caller: Vitest test runner.
 * Deps: ApiError and toUserMessage helper.
 * MainFuncs: Verifies validation messages remain actionable while server errors stay generic.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/api-error';
import { toUserMessage } from './error-message';

describe('toUserMessage', () => {
  it('preserves expected client validation errors', () => {
    expect(toUserMessage(new ApiError('House assignment state changed.', 400, null))).toBe('House assignment state changed.');
  });

  it('hides unexpected server error details', () => {
    expect(toUserMessage(new ApiError('SQL timeout in internal host.', 500, null))).toBe('Action failed. Try again.');
  });
});
