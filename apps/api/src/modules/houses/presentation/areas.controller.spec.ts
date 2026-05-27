/**
 * Purpose: Unit tests for area route permission metadata.
 * Caller: Vitest test runner.
 * Deps: AreasController, permission metadata constants.
 * MainFuncs: Verifies RBAC decorators remain attached to area endpoints.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { AreasController } from './areas.controller';

describe('AreasController permissions', () => {
  it('requires read permission for list and detail routes', () => {
    expect(permissionFor('list')).toEqual({ anyOf: ['areas.read'] });
    expect(permissionFor('get')).toEqual({ anyOf: ['areas.read'] });
  });

  it('requires manage permission for area mutations', () => {
    expect(permissionFor('create')).toEqual({ anyOf: ['areas.manage'] });
    expect(permissionFor('update')).toEqual({ anyOf: ['areas.manage'] });
    expect(permissionFor('archive')).toEqual({ anyOf: ['areas.manage'] });
  });
});

function permissionFor(methodName: string) {
  const method = AreasController.prototype[methodName as keyof AreasController];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
