/**
 * Purpose: Login request DTO for the Auth login endpoint.
 * Caller: AuthController.
 * Deps: class-validator.
 * MainFuncs: Defines login input validation shape.
 * SideEffects: None.
 */
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsUUID()
  rtId?: string;
}
