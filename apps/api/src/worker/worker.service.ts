/**
 * Purpose: Background worker orchestration for durable JIMPITAN job tables.
 * Caller: Worker bootstrap, tests, and container worker command.
 * Deps: ConfigService, ReportsService, TelegramService, filesystem heartbeat.
 * MainFuncs: Processes report export jobs and notification/Telegram outbox jobs with batch limits.
 * SideEffects: Reads/writes database state through services and writes an optional health heartbeat file.
 */
import { writeFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReportsService } from '../modules/reports/application/reports.service';
import { TelegramService } from '../modules/telegram/application/telegram.service';
import type { ReportExportProcessingResult } from '../modules/reports/domain/reports.types';
import type { TelegramOutboxProcessingResult } from '../modules/telegram/domain/telegram.types';

export type WorkerProcessResult = {
  reportExports: ReportExportProcessingResult;
  telegramDelivery: TelegramOutboxProcessingResult;
};

const EMPTY_REPORT_EXPORTS: ReportExportProcessingResult = { processed: 0, completed: 0, failed: 0 };
const EMPTY_TELEGRAM_DELIVERY: TelegramOutboxProcessingResult = { processed: 0, sent: 0, failed: 0 };

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);
  private stopping = false;
  private wakeSleep: (() => void) | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly reports: ReportsService,
    private readonly telegram: TelegramService,
  ) {}

  async run(): Promise<void> {
    if (this.config.get<boolean>('worker.runOnce', false)) {
      await this.processOnce();
      return;
    }

    while (!this.stopping) {
      try {
        await this.processOnce();
      } catch (error) {
        this.logger.error(error instanceof Error ? error.message : 'Worker pass failed');
      }
      if (this.stopping) {
        break;
      }
      await this.sleep(this.pollIntervalMs());
    }
  }

  stop(): void {
    this.stopping = true;
    this.wakeSleep?.();
  }

  async processOnce(correlationId = `worker-${Date.now()}`): Promise<WorkerProcessResult> {
    const queues = this.queueSet();
    const limit = this.batchSize();
    const staleBefore = this.staleBefore();
    const reportExports = queues.has('report-exports') ? await this.reports.processPendingCsvExports({ limit, correlationId, staleBefore }) : EMPTY_REPORT_EXPORTS;
    const telegramDelivery =
      queues.has('notification-outbox') || queues.has('telegram-delivery') ? await this.telegram.processTelegramOutbox({ limit, staleBefore }) : EMPTY_TELEGRAM_DELIVERY;

    await this.writeHealth(correlationId);
    this.logger.log(
      `worker pass ${correlationId} reports=${reportExports.processed}/${reportExports.failed} telegram=${telegramDelivery.processed}/${telegramDelivery.failed}`,
    );
    return { reportExports, telegramDelivery };
  }

  private batchSize(): number {
    const size = this.config.get<number>('worker.batchSize', 20);
    return Math.min(Math.max(size, 1), 50);
  }

  private pollIntervalMs(): number {
    const interval = this.config.get<number>('worker.pollIntervalMs', 5000);
    return Math.max(interval, 1000);
  }

  private staleBefore(): Date {
    const staleJobMs = this.config.get<number>('worker.staleJobMs', 900000);
    return new Date(Date.now() - Math.max(staleJobMs, 60000));
  }

  private queueSet(): Set<string> {
    const queues = this.config.get<string[] | string>('worker.queues', ['notification-outbox', 'report-exports', 'telegram-delivery']);
    const names = Array.isArray(queues) ? queues : queues.split(',');
    return new Set(names.map((queue) => queue.trim()).filter(Boolean));
  }

  private async writeHealth(correlationId: string): Promise<void> {
    const healthFile = this.config.get<string | undefined>('worker.healthFile');
    if (!healthFile) {
      return;
    }
    await writeFile(healthFile, JSON.stringify({ status: 'ok', correlationId, timestamp: new Date().toISOString() }));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wakeSleep = null;
        resolve();
      }, ms);
      this.wakeSleep = () => {
        clearTimeout(timer);
        this.wakeSleep = null;
        resolve();
      };
    });
  }
}
