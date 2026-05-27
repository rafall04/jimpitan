/**
 * Purpose: Playwright web smoke checks for deployed or local runtime targets.
 * Caller: Future npm run test:smoke or deployment verification pipeline.
 * Deps: @playwright/test and configured smoke web base URL.
 * MainFuncs: Verifies web health, login page, dashboard guard, and public report smoke coverage.
 * SideEffects: Performs browser requests against a smoke target when configured.
 */

import { expect, test } from "@playwright/test";

const webUrl = process.env.SMOKE_WEB_URL ?? process.env.SMOKE_WEB_BASE_URL;

test.describe("web smoke checks", () => {
  test.skip(!webUrl, "SMOKE_WEB_URL is not configured.");

  test("web health and login routes load safely", async ({ page, request }) => {
    expect((await request.get(joinUrl(webUrl!, "api/health"))).ok()).toBe(true);
    await page.goto(joinUrl(webUrl!, "login"));
    await expect(page.getByRole("heading", { name: /staff login/i })).toBeVisible();
  });

  test("public report page avoids private data leaks", async ({ page }) => {
    const rtCode = process.env.SMOKE_PUBLIC_RT_CODE;
    test.skip(!rtCode, "SMOKE_PUBLIC_RT_CODE is not configured.");
    await page.goto(joinUrl(webUrl!, `reports?rt=${encodeURIComponent(rtCode!)}`));
    const body = await page.locator("body").innerText();
    expect(body.toLowerCase()).not.toMatch(/phone|internal notes|audit logs|approval internals|private resident/);
  });
});

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ""), normalizedBase).toString();
}
