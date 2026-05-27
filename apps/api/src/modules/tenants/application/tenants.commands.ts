/**
 * Purpose: Command contracts for tenant management use cases.
 * Caller: TenantsController and TenantsService.
 * Deps: None.
 * MainFuncs: Defines validated tenant create/update inputs and request metadata.
 * SideEffects: None.
 */
export type TenantRequestMeta = {
  correlationId?: string;
};

export type CreateTenantCommand = {
  name: string;
  code: string;
  address?: string;
  timezone?: string;
};

export type UpdateTenantCommand = {
  name?: string;
  code?: string;
  address?: string | null;
  timezone?: string;
  isActive?: boolean;
};
