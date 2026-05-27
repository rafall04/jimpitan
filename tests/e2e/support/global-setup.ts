/**
 * Purpose: Playwright global setup for deterministic E2E database fixtures.
 * Caller: playwright.config.ts before E2E specs run.
 * Deps: E2E env loader, Prisma schema push, and fixture seed helpers.
 * MainFuncs: Validates safe E2E env, pushes schema, cleans stale fixtures, seeds fresh fixtures, and writes state.
 * SideEffects: Mutates only the configured E2E test database and writes test-results/e2e-state.json.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { seedMinimalE2EFixtures } from './fixtures';
import { assertSafeE2EEnvironment, loadE2ERuntimeConfig, pushE2EDatabaseSchema, stateFilePath } from './env';

export default async function globalSetup(): Promise<void> {
  const config = loadE2ERuntimeConfig();
  assertSafeE2EEnvironment(config);
  await pushE2EDatabaseSchema(config);
  const fixture = await seedMinimalE2EFixtures(config);
  await mkdir(dirname(stateFilePath()), { recursive: true });
  await writeFile(stateFilePath(), JSON.stringify({ config, fixture }, null, 2));
}
