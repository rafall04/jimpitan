/**
 * Purpose: Playwright E2E coverage for critical JIMPITAN MVP user journeys.
 * Caller: Future npm run test:e2e Playwright runner.
 * Deps: @playwright/test, E2E env loader, deterministic fixtures, and API helper client.
 * MainFuncs: Exercises login, structure CRUD, collection modes, finance posting, public safety, protected auth, and CSV export.
 * SideEffects: Creates, validates, posts, exports, and cleans test-owned records through global teardown.
 */

import { expect, test } from "@playwright/test";

import { readFile } from "node:fs/promises";
import { createE2EApiClient } from "./support/api-client";
import { loadE2ERuntimeConfig, stateFilePath } from "./support/env";
import type { E2ESeedFixture } from "./types/e2e.types";

type E2EStateFile = {
  fixture: E2ESeedFixture;
};

test.describe.serial("critical JIMPITAN MVP journeys", () => {
  test("login, collections, finance posting, public safety, and CSV export", async ({ page }) => {
    const config = loadE2ERuntimeConfig();
    const { fixture } = JSON.parse(await readFile(stateFilePath(), "utf8")) as E2EStateFile;
    const client = createE2EApiClient(config);

    await page.goto("/login");
    await page.getByLabel(/email, phone, or username/i).fill(config.bendaharaEmail);
    await page.getByLabel(/^password$/i).fill(config.bendaharaPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await client.authenticate();
    await client.expectStatus("users/me", 200);

    const area = await client.post<{ id: string; code: string }>("areas", {
      code: `A-${fixture.runId}`,
      name: `Area ${fixture.runId}`,
      sortOrder: 10,
    });
    expect(area.code).toBe(`A-${fixture.runId}`);
    await expectApiObject(await client.get<{ id: string }>(`areas/${area.id}`), area.id);

    const house = await client.post<{ id: string; houseNumber: string }>("houses", {
      areaId: area.id,
      houseNumber: `H-${fixture.runId}`,
      addressNote: "E2E internal address note should stay private",
      status: "EMPTY",
    });
    expect(house.houseNumber).toBe(`H-${fixture.runId}`);
    await expectApiObject(await client.get<{ id: string }>(`houses/${house.id}`), house.id);

    const resident = await client.post<{ id: string; fullName: string }>("residents", {
      houseId: house.id,
      fullName: `E2E Resident ${fixture.runId}`,
      phone: "+6281299999999",
      defaultJimpitanAmount: "2500",
      notes: "E2E internal notes should stay private",
    });
    expect(resident.fullName).toContain("E2E Resident");
    await expectApiObject(await client.get<{ id: string }>(`residents/${resident.id}`), resident.id);

    const perHouse = await client.post<{ id: string; collectionMode: string }>("jimpitan/collections", {
      officerMembershipId: fixture.officerMembershipId,
      collectionDate: "2030-01-15",
      collectionMode: "PER_HOUSE",
      areaId: area.id,
      note: "E2E PER_HOUSE collection",
    });
    expect(perHouse.collectionMode).toBe("PER_HOUSE");
    await client.post(`jimpitan/collections/${perHouse.id}/checklist/generate`);
    await client.put(`jimpitan/collections/${perHouse.id}/items/batch`, {
      items: [
        {
          houseId: house.id,
          residentId: resident.id,
          amount: "2500",
          status: "PAID",
          note: "E2E private collection item note",
        },
      ],
    });
    await client.patch(`jimpitan/collections/${perHouse.id}/submit`, { submitRequestId: `submit-${fixture.runId}-per-house` });
    const validatedPerHouse = await client.patch<{ status: string }>(`jimpitan/collections/${perHouse.id}/validate`, {
      validationNote: "E2E validate per-house",
    });
    expect(validatedPerHouse.status).toBe("VALIDATED");
    const perHousePosting = await client.post<{ transaction: { status: string; sourceCollectionId: string } }>("finance/transactions/source-collections", {
      collectionId: perHouse.id,
      cashAccountId: fixture.cashAccountId,
      categoryId: fixture.incomeCategoryId,
      idempotencyKey: `post-${fixture.runId}-per-house`,
    });
    expect(perHousePosting.transaction.status).toBe("POSTED");
    expect(perHousePosting.transaction.sourceCollectionId).toBe(perHouse.id);

    const bulk = await client.post<{ id: string; collectionMode: string }>("jimpitan/collections", {
      officerMembershipId: fixture.officerMembershipId,
      collectionDate: "2030-01-16",
      collectionMode: "BULK_TOTAL",
      areaId: area.id,
      totalAmount: "7500",
      note: "E2E BULK_TOTAL collection",
    });
    expect(bulk.collectionMode).toBe("BULK_TOTAL");
    await client.put(`jimpitan/collections/${bulk.id}/bulk-total`, { totalAmount: "7500", note: "E2E bulk total" });
    await client.patch(`jimpitan/collections/${bulk.id}/submit`, { submitRequestId: `submit-${fixture.runId}-bulk` });
    const validatedBulk = await client.patch<{ status: string }>(`jimpitan/collections/${bulk.id}/validate`, {
      validationNote: "E2E validate bulk",
    });
    expect(validatedBulk.status).toBe("VALIDATED");
    const bulkPosting = await client.post<{ transaction: { status: string; sourceCollectionId: string } }>("finance/transactions/source-collections", {
      collectionId: bulk.id,
      cashAccountId: fixture.cashAccountId,
      categoryId: fixture.incomeCategoryId,
      idempotencyKey: `post-${fixture.runId}-bulk`,
    });
    expect(bulkPosting.transaction.status).toBe("POSTED");
    expect(bulkPosting.transaction.sourceCollectionId).toBe(bulk.id);

    await page.goto(`/reports?rt=${fixture.publicReportSlug}`);
    await expect(page.getByRole("heading", { name: /ringkasan keuangan publik/i })).toBeVisible();
    const publicText = await page.locator("body").innerText();
    for (const sentinel of [...fixture.privateLeakSentinels, "+6281299999999", "E2E internal notes", "approval internals", "audit logs"]) {
      expect(publicText.toLowerCase()).not.toContain(sentinel.toLowerCase());
    }
    const publicSummary = await client.get<unknown>(`reports/public/${fixture.publicReportSlug}/summary`);
    expect(JSON.stringify(publicSummary).toLowerCase()).not.toMatch(/phone|resident|audit|approval|internal|notes|membership|permission|telegram/);

    const exportRequest = await client.post<{ id: string; status: string }>("reports/exports", {
      reportType: "PUBLIC_MONTHLY_FINANCE",
      format: "CSV",
      visibility: "PUBLIC_SAFE",
      filters: { month: "2030-01" },
      idempotencyKey: `export-${fixture.runId}-public-monthly`,
    });
    expect(exportRequest.status).toBe("COMPLETED");
    const csv = await client.get<string>(`reports/exports/${exportRequest.id}/download`);
    expect(csv).toContain("month");
    expect(csv).toContain("2030-01");
  });
});

async function expectApiObject(record: { id: string }, expectedId: string): Promise<void> {
  expect(record.id).toBe(expectedId);
}
