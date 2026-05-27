/**
 * Purpose: Unit tests for resident route permission metadata.
 * Caller: Vitest test runner.
 * Deps: ResidentsController, permission metadata constants.
 * MainFuncs: Verifies RBAC decorators remain attached to resident endpoints.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { ResidentsController } from './residents.controller';

describe('ResidentsController permissions', () => {
  it('requires read permission for list and detail routes', () => {
    expect(permissionFor('list')).toEqual({ anyOf: ['residents.read'] });
    expect(permissionFor('get')).toEqual({ anyOf: ['residents.read'] });
  });

  it('requires mutation permissions for create, update, move, archive, and reactivate routes', () => {
    expect(permissionFor('create')).toEqual({ anyOf: ['residents.create'] });
    expect(permissionFor('update')).toEqual({ anyOf: ['residents.update'] });
    expect(permissionFor('moveHouse')).toEqual({ anyOf: ['residents.update'] });
    expect(permissionFor('archive')).toEqual({ anyOf: ['residents.delete'] });
    expect(permissionFor('reactivate')).toEqual({ anyOf: ['residents.update'] });
  });
});

function permissionFor(methodName: string) {
  const method = ResidentsController.prototype[methodName as keyof ResidentsController];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
