/**
 * Purpose: Bootstrap the JIMPITAN background worker process.
 * Caller: Node.js runtime in the worker container.
 * Deps: NestFactory application context and WorkerModule.
 * MainFuncs: Starts queue polling and handles SIGINT/SIGTERM graceful shutdown.
 * SideEffects: Opens database/provider connections through Nest providers and keeps a worker loop alive.
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { resolveLogLevels } from '../runtime/logging';
import { WorkerModule } from './worker.module';
import { WorkerService } from './worker.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true, logger: resolveLogLevels() });
  const logger = new Logger('WorkerBootstrap');
  const worker = app.get(WorkerService);

  const shutdown = (signal: string): void => {
    logger.log(`received ${signal}, stopping worker`);
    worker.stop();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  try {
    await worker.run();
  } finally {
    await app.close();
  }
}

void bootstrap();
