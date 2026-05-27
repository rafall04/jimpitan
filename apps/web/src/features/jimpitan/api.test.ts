/**
 * Purpose: Unit tests for Jimpitan browser API adapter request behavior.
 * Caller: Vitest test runner.
 * Deps: Jimpitan API functions and mocked fetch.
 * MainFuncs: Verifies tenant header forwarding, mobile endpoints, PUT item/bulk-total submission, and safe errors.
 * SideEffects: Temporarily replaces global fetch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCollections, setBulkCollectionTotal, upsertCollectionItems } from './api';

describe('jimpitan api', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists mobile officer sessions through the same-origin proxy', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await listCollections('rt-1', { status: 'IN_PROGRESS' }, { mine: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/backend/jimpitan/collections/mobile/my?status=IN_PROGRESS');
    expect(init?.method).toBe('GET');
    expect((init?.headers as Headers).get('X-Tenant-Id')).toBe('rt-1');
  });

  it('uses PUT for batch collection item input and forwards payload once', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'collection-1' }), { status: 200 }));

    await upsertCollectionItems('rt-1', 'collection-1', {
      items: [{ houseId: 'house-1', residentId: null, amount: '0', status: 'UNPAID' }],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/backend/jimpitan/collections/collection-1/items/batch');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ items: [{ houseId: 'house-1', residentId: null, amount: '0', status: 'UNPAID' }] });
  });

  it('uses PUT for bulk total input and forwards the simplified payload once', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'collection-1', collectionMode: 'BULK_TOTAL' }), { status: 200 }));

    await setBulkCollectionTotal('rt-1', 'collection-1', { totalAmount: '75000', note: null });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/backend/jimpitan/collections/collection-1/bulk-total');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ totalAmount: '75000', note: null });
  });

  it('wraps backend validation failures as ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'Paid collection items require an amount greater than zero.' }), { status: 400 }));

    await expect(upsertCollectionItems('rt-1', 'collection-1', { items: [] })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Paid collection items require an amount greater than zero.',
    });
  });
});
