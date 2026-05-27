/**
 * Purpose: Unit tests for structure browser API adapter request behavior.
 * Caller: Vitest test runner.
 * Deps: Structure API functions and mocked fetch.
 * MainFuncs: Verifies tenant header forwarding, query serialization, and error shaping.
 * SideEffects: Temporarily replaces global fetch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listResidents, updateArea } from './api';

describe('structure api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls same-origin proxy with tenant header and serialized filters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await listResidents('rt-1', { search: 'Budi', includeArchived: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/backend/residents?search=Budi&includeArchived=true');
    expect((init?.headers as Headers).get('X-Tenant-Id')).toBe('rt-1');
    expect(init?.credentials).toBe('include');
  });

  it('wraps backend errors as ApiError with safe message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Area cannot be archived while active houses still reference it.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-1' },
      }),
    );

    await expect(updateArea('rt-1', 'area-1', { name: 'A' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Area cannot be archived while active houses still reference it.',
      requestId: 'req-1',
    });
  });
});
