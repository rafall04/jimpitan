/**
 * Purpose: Unit tests for finance and approval form schemas.
 * Caller: Vitest test runner.
 * Deps: Finance schemas.
 * MainFuncs: Verifies transaction amount, rejection reason, and account/category input validation.
 * SideEffects: None.
 */
import { describe, expect, it } from 'vitest';
import { accountSchema, categorySchema, decisionReasonSchema, transactionSchema } from './schemas';

const uuid = '123e4567-e89b-42d3-a456-426614174000';

describe('finance schemas', () => {
  it('accepts conservative transaction draft payloads', () => {
    expect(
      transactionSchema.safeParse({
        cashAccountId: uuid,
        categoryId: uuid,
        amount: '10000',
        description: 'Monthly dues',
        transactionDate: '2026-05-26',
        referenceNumber: '',
      }).success,
    ).toBe(true);
  });

  it('rejects zero or malformed money input', () => {
    expect(transactionSchema.safeParse({ cashAccountId: uuid, categoryId: uuid, amount: '0', description: 'Bad', transactionDate: '2026-05-26', referenceNumber: '' }).success).toBe(false);
    expect(transactionSchema.safeParse({ cashAccountId: uuid, categoryId: uuid, amount: '10.999', description: 'Bad', transactionDate: '2026-05-26', referenceNumber: '' }).success).toBe(false);
  });

  it('requires explicit reasons for rejection workflows', () => {
    expect(decisionReasonSchema.safeParse('no').success).toBe(true);
    expect(decisionReasonSchema.safeParse('').success).toBe(false);
  });

  it('validates account and category management forms', () => {
    expect(accountSchema.safeParse({ key: 'main_cash', name: 'Main Cash', currency: 'IDR' }).success).toBe(true);
    expect(categorySchema.safeParse({ type: 'EXPENSE', key: 'operational', name: 'Operational' }).success).toBe(true);
  });
});
