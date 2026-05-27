/**
 * Purpose: Password and token hash contract for Auth application logic.
 * Caller: AuthService and secure hashing infrastructure.
 * Deps: None.
 * MainFuncs: Defines hash and verification operations.
 * SideEffects: None.
 */
export interface PasswordHasherPort {
  hash(value: string): Promise<string>;
  verify(value: string, hash: string): Promise<boolean>;
}
