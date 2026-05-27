/**
 * Purpose: Refresh-token request DTO for future Auth refresh endpoint.
 * Caller: AuthController once refresh route implementation is approved.
 * Deps: class-validator.
 * MainFuncs: Defines refresh-token input validation shape.
 * SideEffects: None.
 */
import { IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
