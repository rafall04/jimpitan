/**
 * Purpose: Unit tests for house route permission metadata.
 * Caller: Vitest test runner.
 * Deps: HousesController, permission metadata constants.
 * MainFuncs: Verifies RBAC decorators remain attached to house endpoints.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { HousesController } from './houses.controller';

describe('HousesController permissions', () => {
  it('requires read permission for list and detail routes', () => {
    expect(permissionFor('list')).toEqual({ anyOf: ['houses.read'] });
    expect(permissionFor('get')).toEqual({ anyOf: ['houses.read'] });
  });

  it('requires manage permission for house mutations', () => {
    expect(permissionFor('create')).toEqual({ anyOf: ['houses.manage'] });
    expect(permissionFor('update')).toEqual({ anyOf: ['houses.manage'] });
    expect(permissionFor('archive')).toEqual({ anyOf: ['houses.manage'] });
  });
});

function permissionFor(methodName: string) {
  const method = HousesController.prototype[methodName as keyof HousesController];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
