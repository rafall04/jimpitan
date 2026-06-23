/**
 * Purpose: Environment loading boundary for safe deterministic E2E runs.
 * Caller: Playwright global setup, critical journey specs, and smoke helpers.
 * Deps: process.env and tests/e2e/types/e2e.types.ts.
 * MainFuncs: Loads E2E runtime config, applies migrations, and rejects production-like targets.
 * SideEffects: May populate process.env from .env.e2e and run Prisma migrate deploy.
 */

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import type { E2ERuntimeConfig } from "../types/e2e.types";

export function loadE2ERuntimeConfig(): E2ERuntimeConfig {
  loadDotEnvFile(".env.e2e");
  const webBaseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
  const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3101/api/v1";
  const databaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  const runId = sanitizeRunId(process.env.E2E_NAMESPACE ?? process.env.E2E_RUN_ID ?? "e2e-mvp");
  return {
    runId,
    webBaseUrl,
    apiBaseUrl,
    databaseUrl,
    adminEmail: process.env.E2E_ADMIN_EMAIL ?? `super-admin.${runId}@e2e.local`,
    adminPassword: process.env.E2E_ADMIN_PASSWORD ?? "E2ePassword123!",
    bendaharaEmail: process.env.E2E_BENDAHARA_EMAIL ?? `bendahara.${runId}@e2e.local`,
    bendaharaPassword: process.env.E2E_BENDAHARA_PASSWORD ?? "E2ePassword123!",
    telegramSecretToken: process.env.E2E_TELEGRAM_SECRET_TOKEN,
  };
}

function sanitizeRunId(runId: string): string {
  return runId.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32) || "e2e-mvp";
}

export function assertSafeE2EEnvironment(config: E2ERuntimeConfig): void {
  if (!config.databaseUrl) {
    throw new Error("E2E_DATABASE_URL or DATABASE_URL is required for E2E runs.");
  }
  const combined = `${config.databaseUrl} ${config.webBaseUrl} ${config.apiBaseUrl}`.toLowerCase();
  const unsafeMarkers = ["production", "prod", "example.com"];
  if (unsafeMarkers.some((marker) => combined.includes(marker))) {
    throw new Error("E2E targets must be disposable test targets, not production-like hosts or databases.");
  }
  if (!/(e2e|test|localhost|127\.0\.0\.1)/i.test(combined)) {
    throw new Error("E2E target names must clearly identify a test or local environment.");
  }
}

export async function migrateE2EDatabase(config: E2ERuntimeConfig): Promise<void> {
  if (process.env.E2E_SKIP_DB_SETUP === "true") {
    return;
  }
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  // Apply real migrations (not `db push`) so the E2E database carries production-only objects the
  // schema cannot express — e.g. the cash_ledgers append-only trigger and CHECK constraints.
  const result = spawnSync(executable, ["run", "migrate:deploy"], {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      DATABASE_URL: config.databaseUrl,
    },
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error("Failed to apply Prisma migrations to the E2E database.");
  }
}

export function stateFilePath(): string {
  return "test-results/e2e-state.json";
}

function loadDotEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }
  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const [key, ...valueParts] = trimmed.split("=");
    if (!process.env[key]) {
      process.env[key] = valueParts.join("=").replace(/^"|"$/g, "");
    }
  }
}
