/**
 * Purpose: Unit tests for the background worker orchestration foundation.
 * Caller: Vitest test runner.
 * Deps: WorkerService with mocked report and Telegram services plus config.
 * MainFuncs: Verifies queue selection, batch sizing, outbox/export delegation, and health heartbeat writes.
 * SideEffects: Writes a temporary worker health file during tests.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { WorkerService } from './worker.service';

function createHarness(overrides: Record<string, any> = {}) {
  const reports = {
    processPendingCsvExports: vi.fn(async () => ({ processed: 1, completed: 1, failed: 0 })),
    ...overrides.reports,
  };
  const telegram = {
    processTelegramOutbox: vi.fn(async () => ({ processed: 2, sent: 2, failed: 0 })),
    ...overrides.telegram,
  };
  const config = {
    get: vi.fn((key: string, fallback?: unknown) => {
      const values: Record<string, unknown> = {
        'worker.batchSize': 25,
        'worker.queues': ['notification-outbox', 'report-exports', 'telegram-delivery'],
        ...overrides.configValues,
      };
      return values[key] ?? fallback;
    }),
  };
  return { config, reports, service: new WorkerService(config as any, reports as any, telegram as any), telegram };
}

describe('WorkerService', () => {
  it('processes notification outbox, Telegram delivery, and export jobs with one batch size', async () => {
    const { reports, service, telegram } = createHarness();

    const result = await service.processOnce('worker-run-1');

    expect(reports.processPendingCsvExports).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, correlationId: 'worker-run-1', staleBefore: expect.any(Date) }));
    expect(telegram.processTelegramOutbox).toHaveBeenCalledWith(expect.objectContaining({ limit: 25, staleBefore: expect.any(Date) }));
    expect(result).toEqual({
      reportExports: { processed: 1, completed: 1, failed: 0 },
      telegramDelivery: { processed: 2, sent: 2, failed: 0 },
    });
  });

  it('skips disabled queues without calling their processors', async () => {
    const { reports, service, telegram } = createHarness({ configValues: { 'worker.queues': ['report-exports'] } });

    const result = await service.processOnce('worker-run-2');

    expect(reports.processPendingCsvExports).toHaveBeenCalled();
    expect(telegram.processTelegramOutbox).not.toHaveBeenCalled();
    expect(result.telegramDelivery).toEqual({ processed: 0, sent: 0, failed: 0 });
  });

  it('writes a worker health heartbeat after a successful processing pass', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'jimpitan-worker-'));
    const healthFile = join(tempDir, 'health');
    const { service } = createHarness({ configValues: { 'worker.healthFile': healthFile } });

    try {
      await service.processOnce('worker-run-3');

      await expect(readFile(healthFile, 'utf8')).resolves.toContain('worker-run-3');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('wakes the polling loop when stop is requested', async () => {
    const { service } = createHarness({ configValues: { 'worker.pollIntervalMs': 30000 } });

    const runPromise = service.run();
    await Promise.resolve();
    service.stop();

    await expect(Promise.race([runPromise.then(() => 'stopped'), delay(50).then(() => 'timed-out')])).resolves.toBe('stopped');
  });
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
