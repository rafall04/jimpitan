/**
 * Purpose: Unit tests for finance cash account and category route permission metadata.
 * Caller: Vitest test runner.
 * Deps: CashAccountsController, TransactionCategoriesController, and permission metadata constants.
 * MainFuncs: Verifies RBAC decorators remain attached to finance administration endpoints.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { CashAccountsController } from './cash-accounts.controller';
import { TransactionCategoriesController } from './transaction-categories.controller';

describe('Finance administration controller permissions', () => {
  it('requires transaction permissions for cash account endpoints', () => {
    expect(permissionFor(CashAccountsController, 'list')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor(CashAccountsController, 'defaultCashAccount')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor(CashAccountsController, 'get')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor(CashAccountsController, 'balance')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor(CashAccountsController, 'create')).toEqual({ anyOf: ['transactions.create'] });
    expect(permissionFor(CashAccountsController, 'update')).toEqual({ anyOf: ['transactions.update'] });
    expect(permissionFor(CashAccountsController, 'archive')).toEqual({ anyOf: ['transactions.delete'] });
  });

  it('requires transaction permissions for category endpoints', () => {
    expect(permissionFor(TransactionCategoriesController, 'list')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor(TransactionCategoriesController, 'get')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor(TransactionCategoriesController, 'create')).toEqual({ anyOf: ['transactions.create'] });
    expect(permissionFor(TransactionCategoriesController, 'update')).toEqual({ anyOf: ['transactions.update'] });
    expect(permissionFor(TransactionCategoriesController, 'archive')).toEqual({ anyOf: ['transactions.delete'] });
  });
});

function permissionFor(controller: { prototype: object }, methodName: string) {
  const method = controller.prototype[methodName as keyof typeof controller.prototype];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
