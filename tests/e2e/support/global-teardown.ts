/**
 * Purpose: Playwright global teardown for deterministic E2E database fixtures.
 * Caller: playwright.config.ts after E2E specs finish.
 * Deps: E2E env loader, fixture cleanup helper, and persisted E2E state file.
 * MainFuncs: Loads the latest E2E fixture state and removes test-owned records.
 * SideEffects: Deletes only records under the configured E2E tenant namespace.
 */
import { readFile, rm } from 'node:fs/promises';
import { cleanupE2EFixtures } from './fixtures';
import { loadE2ERuntimeConfig, stateFilePath } from './env';
import type { E2ESeedFixture } from '../types/e2e.types';

type E2EStateFile = {
  fixture: E2ESeedFixture;
};

export default async function globalTeardown(): Promise<void> {
  const config = loadE2ERuntimeConfig();
  try {
    const state = JSON.parse(await readFile(stateFilePath(), 'utf8')) as E2EStateFile;
    await cleanupE2EFixtures(config, state.fixture);
  } catch {
    await cleanupE2EFixtures(config);
  } finally {
    await rm(stateFilePath(), { force: true });
  }
}
