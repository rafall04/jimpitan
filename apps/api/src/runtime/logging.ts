/**
 * Purpose: Shared NestJS logging level resolver for API and worker runtime processes.
 * Caller: API bootstrap and worker bootstrap.
 * Deps: NestJS logger level type and process environment.
 * MainFuncs: Maps LOG_LEVEL into conservative Nest logger levels.
 * SideEffects: Reads process environment.
 */
import type { LogLevel } from '@nestjs/common';

export function resolveLogLevels(): LogLevel[] {
  const level = process.env.LOG_LEVEL ?? 'info';
  if (level === 'debug') {
    return ['debug', 'log', 'warn', 'error'];
  }
  if (level === 'warn') {
    return ['warn', 'error'];
  }
  if (level === 'error') {
    return ['error'];
  }
  return ['log', 'warn', 'error'];
}
