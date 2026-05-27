/**
 * Purpose: Prisma client lifecycle boundary for NestJS.
 * Caller: Repositories and infrastructure providers that need database access.
 * Deps: @prisma/client, NestJS lifecycle interfaces.
 * MainFuncs: Connects and disconnects Prisma with the application lifecycle.
 * SideEffects: Opens and closes PostgreSQL connections.
 */
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
