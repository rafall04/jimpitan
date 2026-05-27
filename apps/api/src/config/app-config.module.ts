/**
 * Purpose: NestJS configuration module for environment-backed API settings.
 * Caller: AppModule imports during backend bootstrap.
 * Deps: @nestjs/config, configuration factory, environment validation.
 * MainFuncs: Loads typed runtime configuration and validates required environment variables.
 * SideEffects: Reads process environment during application startup.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './configuration';
import { validateEnvironment } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
  ],
})
export class AppConfigModule {}
