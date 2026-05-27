/**
 * Purpose: Unit tests for Jimpitan form schemas and collection item payload mapping.
 * Caller: Vitest test runner.
 * Deps: Jimpitan schemas and mappers.
 * MainFuncs: Verifies UI validation mirrors backend item and bulk-total amount/status rules and strips optional notes safely.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { bulkTotalSchema, collectionItemFormSchema, createCollectionSchema, toBulkTotalPayload, toCollectionItemPayload } from './schemas';

describe('jimpitan schemas', () => {
  it('builds paid item payloads with positive amount and resident ownership', () => {
    const values = collectionItemFormSchema.parse({
      houseId: '11111111-1111-4111-8111-111111111111',
      residentId: '22222222-2222-4222-8222-222222222222',
      amount: '2000',
      status: 'PAID',
      note: '',
    });

    expect(toCollectionItemPayload(values)).toEqual({
      houseId: '11111111-1111-4111-8111-111111111111',
      residentId: '22222222-2222-4222-8222-222222222222',
      amount: '2000',
      status: 'PAID',
    });
  });

  it('rejects paid items without a positive amount', () => {
    expect(() =>
      collectionItemFormSchema.parse({
        houseId: '11111111-1111-4111-8111-111111111111',
        residentId: '',
        amount: '0',
        status: 'PAID',
        note: '',
      }),
    ).toThrow();
  });

  it('forces non-paid statuses to submit zero amount', () => {
    const values = collectionItemFormSchema.parse({
      houseId: '11111111-1111-4111-8111-111111111111',
      residentId: '',
      amount: '',
      status: 'HOUSE_EMPTY',
      note: 'Locked',
    });

    expect(toCollectionItemPayload(values)).toEqual({
      houseId: '11111111-1111-4111-8111-111111111111',
      residentId: null,
      amount: '0',
      status: 'HOUSE_EMPTY',
      note: 'Locked',
    });
  });

  it('keeps per-house creation from accepting manual totals', () => {
    expect(() =>
      createCollectionSchema.parse({
        officerMembershipId: '11111111-1111-4111-8111-111111111111',
        collectionDate: '2030-01-01',
        collectionMode: 'PER_HOUSE',
        totalAmount: '75000',
        areaId: '',
        note: '',
      }),
    ).toThrow();
  });

  it('maps bulk total payloads as positive whole rupiah amounts', () => {
    const values = bulkTotalSchema.parse({ totalAmount: '75000', note: '' });

    expect(toBulkTotalPayload(values)).toEqual({ totalAmount: '75000', note: null });
    expect(() => bulkTotalSchema.parse({ totalAmount: '0', note: '' })).toThrow();
    expect(() => bulkTotalSchema.parse({ totalAmount: '10.50', note: '' })).toThrow();
  });
});
