/**
 * Purpose: Stable dependency injection tokens for the expense approval module.
 * Caller: ApprovalsModule, ApprovalsService, and approval infrastructure adapters.
 * Deps: None.
 * MainFuncs: Defines repository and notification hook provider tokens.
 * SideEffects: None.
 */
export const APPROVALS_REPOSITORY = Symbol('APPROVALS_REPOSITORY');
export const APPROVAL_NOTIFICATION_HOOKS = Symbol('APPROVAL_NOTIFICATION_HOOKS');
