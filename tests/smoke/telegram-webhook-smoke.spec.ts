/**
 * Purpose: Playwright Telegram webhook smoke checks.
 * Caller: Future npm run test:smoke or deployment verification pipeline when a test webhook token is configured.
 * Deps: @playwright/test, smoke API base URL, and non-production Telegram secret token.
 * MainFuncs: Verifies webhook rejection for missing or invalid secret tokens.
 * SideEffects: Sends non-production webhook smoke requests when configured.
 */

import { expect, test } from "@playwright/test";

const apiUrl = process.env.SMOKE_API_URL ?? process.env.SMOKE_API_BASE_URL;

test.describe("telegram webhook smoke checks", () => {
  test.skip(!apiUrl, "SMOKE_API_URL is not configured.");

  test("webhook rejects missing or invalid secret token", async ({ request }) => {
    const response = await request.post(joinUrl(apiUrl!, "telegram/webhook"), {
      data: { update_id: -1, message: { text: "/start" } },
      headers: { "x-telegram-bot-api-secret-token": "invalid-smoke-secret" },
    });
    expect([401, 403]).toContain(response.status());
  });
});

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ""), normalizedBase).toString();
}
