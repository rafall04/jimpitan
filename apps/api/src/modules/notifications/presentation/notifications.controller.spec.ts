/**
 * Purpose: Unit tests for notification route RBAC metadata.
 * Caller: Vitest test runner.
 * Deps: NotificationsController and permission metadata constants.
 * MainFuncs: Verifies notification read and delivery administration endpoints are permission guarded.
 * SideEffects: None.
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { PERMISSION_REQUIREMENT_METADATA } from '../../../common/constants/metadata.constants';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController permissions', () => {
  it('requires notification read permission for current-user notification endpoints', () => {
    expect(permissionFor('list')).toEqual({ anyOf: ['notifications.read'] });
    expect(permissionFor('unreadCount')).toEqual({ anyOf: ['notifications.read'] });
    expect(permissionFor('markRead')).toEqual({ anyOf: ['notifications.read'] });
    expect(permissionFor('markAllRead')).toEqual({ anyOf: ['notifications.read'] });
  });

  it('requires notification management permission for delivery administration endpoints', () => {
    expect(permissionFor('create')).toEqual({ anyOf: ['notifications.manage'] });
    expect(permissionFor('deliveryStatus')).toEqual({ anyOf: ['notifications.manage'] });
    expect(permissionFor('cancel')).toEqual({ anyOf: ['notifications.manage'] });
    expect(permissionFor('retry')).toEqual({ anyOf: ['notifications.manage'] });
    expect(permissionFor('markDelivery')).toEqual({ anyOf: ['notifications.manage'] });
  });
});

function permissionFor(methodName: string) {
  const method = NotificationsController.prototype[methodName as keyof NotificationsController];
  return Reflect.getMetadata(PERMISSION_REQUIREMENT_METADATA, method as object);
}
