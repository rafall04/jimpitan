/**
 * Purpose: Vitest workspace configuration for backend and frontend tests.
 * Caller: npm run test:api and npm run test:web.
 * Deps: Vitest config API and Node URL helpers.
 * MainFuncs: Provides the frontend @ path alias during test execution.
 * SideEffects: None.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
    },
  },
});
