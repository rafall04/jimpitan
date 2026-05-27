/**
 * Purpose: Unit tests for approval route RBAC metadata.
 * Caller: Vitest test runner.
 * Deps: ApprovalsController and permission metadata constants.
 * MainFuncs: Verifies approval read, request, decision, cancellation, and policy endpoints are permission guarded.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { ApprovalsController } from './approvals.controller';

describe('ApprovalsController permissions', () => {
  it('requires approval read permission for queues and detail', () => {
    expect(permissionFor('list')).toEqual({ anyOf: ['approvals.read'] });
    expect(permissionFor('queue')).toEqual({ anyOf: ['approvals.read', 'approvals.decide'] });
    expect(permissionFor('get')).toEqual({ anyOf: ['approvals.read', 'approvals.decide'] });
    expect(permissionFor('status')).toEqual({ anyOf: ['approvals.read', 'transactions.read'] });
    expect(permissionFor('getPolicy')).toEqual({ anyOf: ['settings.read', 'approvals.read'] });
  });

  it('requires decision or settings permissions for mutating approval routes', () => {
    expect(permissionFor('request')).toEqual({ anyOf: ['transactions.validate', 'approvals.decide'] });
    expect(permissionFor('approve')).toEqual({ anyOf: ['approvals.decide'] });
    expect(permissionFor('reject')).toEqual({ anyOf: ['approvals.decide'] });
    expect(permissionFor('cancel')).toEqual({ anyOf: ['approvals.decide'] });
    expect(permissionFor('updatePolicy')).toEqual({ anyOf: ['settings.update'] });
  });
});

function permissionFor(methodName: string) {
  const method = ApprovalsController.prototype[methodName as keyof ApprovalsController];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
