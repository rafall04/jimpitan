/**
 * Purpose: NestJS module boundary for authentication.
 * Caller: AppModule imports and protected route guard wiring.
 * Deps: AuthController, AuthService, JWT, bcrypt, Prisma auth repository, auth guards.
 * MainFuncs: Registers authentication endpoints, use cases, adapters, and exported guards.
 * SideEffects: Provides JWT signing and session persistence adapters through DI.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { AUTH_REPOSITORY, AUTH_TOKEN_SERVICE, PASSWORD_HASHER } from './auth.tokens';
import { AuthService } from './application/auth.service';
import { BcryptPasswordHasherService } from './infrastructure/bcrypt-password-hasher.service';
import { JwtAuthTokenService } from './infrastructure/jwt-auth-token.service';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository';
import { AuthController } from './presentation/auth.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthenticationGuard,
    TenantGuard,
    PrismaAuthRepository,
    BcryptPasswordHasherService,
    JwtAuthTokenService,
    { provide: AUTH_REPOSITORY, useExisting: PrismaAuthRepository },
    { provide: PASSWORD_HASHER, useExisting: BcryptPasswordHasherService },
    { provide: AUTH_TOKEN_SERVICE, useExisting: JwtAuthTokenService },
  ],
  exports: [AuthService, AuthenticationGuard, TenantGuard, PASSWORD_HASHER],
})
export class AuthModule {}
