/**
 * Purpose: NestJS module boundary for user and membership management.
 * Caller: AppModule imports and user route wiring.
 * Deps: AuthModule, RbacModule, UsersController, UsersService, Prisma user repository.
 * MainFuncs: Registers user presentation, application, and persistence providers.
 * SideEffects: Provides user repository binding through DI.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { USERS_REPOSITORY } from './users.tokens';
import { UsersService } from './application/users.service';
import { PrismaUsersRepository } from './infrastructure/prisma-users.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [AuthModule, RbacModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    PrismaUsersRepository,
    { provide: USERS_REPOSITORY, useExisting: PrismaUsersRepository },
  ],
  exports: [UsersService],
})
export class UsersModule {}
