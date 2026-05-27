/**
 * Purpose: Change-password request DTO for future Auth password endpoint.
 * Caller: AuthController once password route implementation is approved.
 * Deps: class-validator.
 * MainFuncs: Defines password-change input validation shape.
 * SideEffects: None.
 */
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  newPassword!: string;
}
