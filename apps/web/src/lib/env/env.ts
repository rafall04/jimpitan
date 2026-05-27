/**
 * Purpose: Frontend environment validation and normalization.
 * Caller: API client, runtime configuration helpers, and tests.
 * Deps: zod.
 * MainFuncs: Parses required public API URL and optional public app URL without hardcoded defaults.
 * SideEffects: None.
 */
import { z } from 'zod';

const webEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url('NEXT_PUBLIC_API_BASE_URL must be an absolute URL.'),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be an absolute URL.').optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function parseWebEnv(source: Record<string, string | undefined>): WebEnv {
  return webEnvSchema.parse(source);
}

export function getWebEnv(): WebEnv {
  return parseWebEnv({
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}
