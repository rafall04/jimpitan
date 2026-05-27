/**
 * Purpose: Playwright API smoke checks for deployed or local runtime targets.
 * Caller: Future npm run test:smoke or deployment verification pipeline.
 * Deps: @playwright/test and configured smoke API base URL.
 * MainFuncs: Verifies API liveness, readiness, and protected endpoint rejection.
 * SideEffects: Performs safe HTTP requests against a smoke target when configured.
 */

import { expect, test } from "@playwright/test";

const apiUrl = process.env.SMOKE_API_URL ?? process.env.SMOKE_API_BASE_URL;

test.describe("api smoke checks", () => {
  test.skip(!apiUrl, "SMOKE_API_URL is not configured.");

  test("health and readiness endpoints respond safely", async ({ request }) => {
    expect((await request.get(joinUrl(apiUrl!, "health"))).ok()).toBe(true);
    expect((await request.get(joinUrl(apiUrl!, "health/ready"))).ok()).toBe(true);
  });

  test("protected endpoint rejects unauthenticated access", async ({ request }) => {
    const response = await request.get(joinUrl(apiUrl!, "users/me"));
    expect([401, 403]).toContain(response.status());
  });
});

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ""), normalizedBase).toString();
}
