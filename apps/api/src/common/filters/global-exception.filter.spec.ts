/**
 * Purpose: Unit tests for the global exception filter envelope and 500 detail suppression.
 * Caller: Vitest test runner.
 * Deps: GlobalExceptionFilter, Nest HttpException, Logger, and a mocked ArgumentsHost.
 * MainFuncs: Verifies HttpException messages are preserved and non-HTTP errors return a generic message without leaking internals.
 * SideEffects: None.
 */
import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobalExceptionFilter } from './global-exception.filter';

function mockHost(correlationId?: string) {
  const json = vi.fn((_body: unknown) => undefined);
  const status = vi.fn((_code: number) => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ correlationId }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves the message and status for HttpExceptions', () => {
    const { host, status, json } = mockHost('corr-1');

    new GlobalExceptionFilter().catch(new BadRequestException('Amount must be positive'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.objectContaining({ message: 'Amount must be positive', requestId: 'corr-1' }) }));
  });

  it('returns a generic message for unexpected errors without leaking internals', () => {
    const { host, status, json } = mockHost('corr-2');

    new GlobalExceptionFilter().catch(new Error('connect ECONNREFUSED postgres://secret@db:5432'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0]?.[0] as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('Internal server error.');
    expect(JSON.stringify(body)).not.toContain('postgres://secret');
  });
});
