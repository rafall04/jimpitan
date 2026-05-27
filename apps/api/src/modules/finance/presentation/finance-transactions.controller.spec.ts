/**
 * Purpose: Unit tests for finance transaction route permission metadata.
 * Caller: Vitest test runner.
 * Deps: FinanceTransactionsController and permission metadata constants.
 * MainFuncs: Verifies RBAC decorators remain attached to transaction lifecycle endpoints.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { FinanceTransactionsController } from './finance-transactions.controller';

describe('FinanceTransactionsController permissions', () => {
  it('requires transaction read permission for read-only endpoints', () => {
    expect(permissionFor('list')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor('get')).toEqual({ anyOf: ['transactions.read'] });
  });

  it('requires workflow permissions for finance mutations', () => {
    expect(permissionFor('createIncome')).toEqual({ anyOf: ['transactions.create'] });
    expect(permissionFor('createExpense')).toEqual({ anyOf: ['transactions.create'] });
    expect(permissionFor('validate')).toEqual({ anyOf: ['transactions.validate'] });
    expect(permissionFor('reject')).toEqual({ anyOf: ['transactions.validate'] });
    expect(permissionFor('voidDraft')).toEqual({ anyOf: ['transactions.delete'] });
    expect(permissionFor('post')).toEqual({ anyOf: ['transactions.post'] });
    expect(permissionFor('postCollection')).toEqual({ anyOf: ['transactions.post'] });
  });
});

function permissionFor(methodName: string) {
  const method = FinanceTransactionsController.prototype[methodName as keyof FinanceTransactionsController];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
