/**
 * Purpose: Tenant domain DTO types exposed by the tenant application boundary.
 * Caller: Tenant service, controller, and repository contracts.
 * Deps: None.
 * MainFuncs: Defines safe RT tenant response shapes.
 * SideEffects: None.
 */
export type TenantRecord = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type TenantListScope = {
  rtId?: string;
  includeAll: boolean;
};
