/**
 * Purpose: E2E suite launcher and environment gate.
 * Caller: npm run test:e2e and future CI pipelines.
 * Deps: tests/e2e, Playwright runtime, seeded test database, and local web/API services.
 * MainFuncs: Validates the critical journey contract and runs Playwright only when a complete E2E environment is configured.
 * SideEffects: Runtime Playwright execution may create and clean deterministic test data when enabled.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const E2E_COMMAND_CONTRACT = Object.freeze({
  runner: "playwright",
  requiredEnv: ["E2E_DATABASE_URL"],
  journeys: [
    "login",
    "create-read-area",
    "create-read-house",
    "create-read-resident",
    "create-per-house-session",
    "input-collection-item",
    "submit-and-validate-session",
    "post-collection-to-finance",
    "create-bulk-total-session",
    "submit-bulk-total",
    "validate-and-post-bulk-total",
    "public-report-page",
    "export-csv",
  ],
});

export async function runE2ECommand() {
  loadDotEnvFile(".env.e2e");
  const missingEnv = E2E_COMMAND_CONTRACT.requiredEnv.filter((name) => !process.env[name]);
  if (missingEnv.length > 0) {
    console.warn(`WARN E2E runtime skipped; missing ${missingEnv.join(", ")}.`);
    console.log(`E2E journey contract covers ${E2E_COMMAND_CONTRACT.journeys.length} critical journey(s).`);
    return;
  }

  assertSafeE2ETargets();
  if (!existsSync("playwright.config.ts") || !existsSync("node_modules/@playwright/test")) {
    console.error("FAIL Playwright runtime is not installed/configured. Add @playwright/test and playwright.config.ts before running full E2E.");
    process.exit(1);
  }

  const runner = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(runner, ["playwright", "test", "tests/e2e"], { stdio: "inherit", shell: false });
  process.exit(result.status ?? 1);
}

function assertSafeE2ETargets() {
  const databaseUrl = process.env.E2E_DATABASE_URL ?? "";
  const webBaseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100";
  const apiBaseUrl = process.env.E2E_API_BASE_URL ?? "http://127.0.0.1:3101/api/v1";
  const combined = `${databaseUrl} ${webBaseUrl} ${apiBaseUrl}`.toLowerCase();
  if (combined.includes("production") || combined.includes("prod") || combined.includes("example.com")) {
    console.error("FAIL E2E targets must be disposable test targets, not production-like hosts or databases.");
    process.exit(1);
  }
}

function loadDotEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runE2ECommand();
}
