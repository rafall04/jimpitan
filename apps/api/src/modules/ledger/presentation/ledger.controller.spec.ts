/**
 * Purpose: Unit tests for ledger route permission metadata.
 * Caller: Vitest test runner.
 * Deps: LedgerController and permission metadata constants.
 * MainFuncs: Verifies RBAC decorators remain attached to append-only ledger read endpoints.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { LedgerController } from './ledger.controller';

describe('LedgerController permissions', () => {
  it('requires transaction read permission for all ledger endpoints', () => {
    expect(permissionFor('list')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor('balance')).toEqual({ anyOf: ['transactions.read'] });
    expect(permissionFor('get')).toEqual({ anyOf: ['transactions.read'] });
  });
});

function permissionFor(methodName: string) {
  const method = LedgerController.prototype[methodName as keyof LedgerController];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
