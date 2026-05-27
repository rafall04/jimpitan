/**
 * Purpose: Unit tests for jimpitan collection route permission metadata.
 * Caller: Vitest test runner.
 * Deps: JimpitanController, permission metadata constants.
 * MainFuncs: Verifies RBAC decorators remain attached to collection endpoints.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { JimpitanController } from './jimpitan.controller';

describe('JimpitanController permissions', () => {
  it('requires collection read permission for read-only endpoints', () => {
    expect(permissionFor('list')).toEqual({ anyOf: ['collections.read'] });
    expect(permissionFor('listMyMobile')).toEqual({ anyOf: ['collections.read', 'collections.update_own'] });
    expect(permissionFor('get')).toEqual({ anyOf: ['collections.read'] });
    expect(permissionFor('getChecklist')).toEqual({ anyOf: ['collections.read'] });
    expect(permissionFor('summary')).toEqual({ anyOf: ['collections.read'] });
    expect(permissionFor('outstanding')).toEqual({ anyOf: ['collections.read'] });
  });

  it('requires workflow permissions for mutation endpoints', () => {
    expect(permissionFor('create')).toEqual({ anyOf: ['collections.create'] });
    expect(permissionFor('update')).toEqual({ anyOf: ['collections.create', 'collections.validate'] });
    expect(permissionFor('start')).toEqual({ anyOf: ['collections.update_own', 'collections.validate'] });
    expect(permissionFor('cancel')).toEqual({ anyOf: ['collections.reject', 'collections.validate'] });
    expect(permissionFor('generateChecklist')).toEqual({ anyOf: ['collections.update_own', 'collections.validate'] });
    expect(permissionFor('upsertItems')).toEqual({ anyOf: ['collections.update_own', 'collections.validate'] });
    expect(permissionFor('submit')).toEqual({ anyOf: ['collections.submit_own', 'collections.validate'] });
    expect(permissionFor('validate')).toEqual({ anyOf: ['collections.validate'] });
    expect(permissionFor('reject')).toEqual({ anyOf: ['collections.reject'] });
  });
});

function permissionFor(methodName: string) {
  const method = JimpitanController.prototype[methodName as keyof JimpitanController];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
