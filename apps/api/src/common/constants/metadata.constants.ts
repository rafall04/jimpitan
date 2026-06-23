/**
 * Purpose: Metadata constants shared by decorators and guards.
 * Caller: Auth/RBAC decorators and guards.
 * Deps: None.
 * MainFuncs: Defines stable metadata keys for NestJS reflection.
 * SideEffects: None.
 */
export const PERMISSION_REQUIREMENT_METADATA = 'jimpitan:permission-requirement';
export const IS_PUBLIC_ROUTE_METADATA = 'jimpitan:is-public-route';
export const SKIP_TENANT_GUARD_METADATA = 'jimpitan:skip-tenant-guard';
