/**
 * Purpose: API, web, and optional Telegram smoke checks.
 * Caller: npm run test:smoke and deployment verification workflows.
 * Deps: Running API/web targets and safe non-production smoke env values.
 * MainFuncs: Runs safe HTTP health checks when smoke URLs are configured and otherwise documents the skipped runtime checks.
 * SideEffects: Performs read-only HTTP checks and optional invalid-secret Telegram webhook validation.
 */

import { pathToFileURL } from "node:url";

export const SMOKE_CHECK_CONTRACT = Object.freeze({
  targets: ["api-health", "api-ready", "web-health", "public-page", "protected-endpoint", "telegram-webhook"],
  requiredEnv: ["SMOKE_WEB_URL", "SMOKE_API_URL"],
  optionalEnv: ["SMOKE_PUBLIC_RT_CODE", "SMOKE_TELEGRAM_SECRET_TOKEN"],
});

export async function runSmokeChecks() {
  const webBaseUrl = process.env.SMOKE_WEB_URL ?? process.env.SMOKE_WEB_BASE_URL;
  const apiBaseUrl = process.env.SMOKE_API_URL ?? process.env.SMOKE_API_BASE_URL;
  if (!webBaseUrl || !apiBaseUrl) {
    console.warn("WARN runtime smoke checks skipped; set SMOKE_WEB_URL and SMOKE_API_URL.");
    console.log(`Smoke check contract loaded for ${SMOKE_CHECK_CONTRACT.targets.length} target(s).`);
    return;
  }

  const failures = [];
  await expectOk(joinUrl(apiBaseUrl, "health"), "api-health", failures);
  await expectOk(joinUrl(apiBaseUrl, "health/ready"), "api-ready", failures);
  await expectOk(joinUrl(webBaseUrl, "api/health"), "web-health", failures);
  await expectStatus(joinUrl(apiBaseUrl, "users/me"), "protected-endpoint-unauthenticated", [401, 403], failures);

  const publicRtCode = process.env.SMOKE_PUBLIC_RT_CODE;
  if (publicRtCode) {
    await expectOk(joinUrl(webBaseUrl, `reports?rt=${encodeURIComponent(publicRtCode)}`), "public-page", failures);
    await expectOk(joinUrl(apiBaseUrl, `reports/public/${encodeURIComponent(publicRtCode)}/summary`), "public-report-api", failures);
  } else {
    console.warn("WARN public report smoke skipped; set SMOKE_PUBLIC_RT_CODE.");
  }

  if (process.env.SMOKE_TELEGRAM_WEBHOOK_REJECTION === "true") {
    await expectStatus(joinUrl(apiBaseUrl, "telegram/webhook"), "telegram-webhook-invalid-secret", [401, 403], failures, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "invalid-smoke-secret" },
      body: JSON.stringify({ update_id: -1, message: { text: "/start" } }),
    });
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`FAIL ${failure}`);
    }
    process.exit(1);
  }

  console.log("Smoke checks passed.");
}

async function expectOk(url, label, failures) {
  await expectStatus(url, label, [200], failures);
}

async function expectStatus(url, label, allowedStatuses, failures, init = {}) {
  try {
    const response = await fetchWithTimeout(url, init);
    if (!allowedStatuses.includes(response.status)) {
      failures.push(`${label} returned HTTP ${response.status} for ${url}`);
    }
  } catch (error) {
    failures.push(`${label} failed for ${url}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.SMOKE_TIMEOUT_MS ?? 5000));
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

function joinUrl(base, path) {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return new URL(path.replace(/^\/+/, ""), normalizedBase).toString();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runSmokeChecks();
}
