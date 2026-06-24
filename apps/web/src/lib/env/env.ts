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

/**
 * Server-side API origin for SSR/BFF/auth fetches. Prefers a private internal address
 * (`API_INTERNAL_BASE_URL`) so server-to-server calls never hair-pin out through the public
 * edge (e.g. a Cloudflare tunnel). In the browser bundle `process.env.API_INTERNAL_BASE_URL`
 * is inlined as `undefined`, so this transparently falls back to the public base URL.
 * Use this for fetches only — image `src` values must stay on the public URL the browser loads.
 */
export function getServerApiBaseUrl(): string {
  const internal = process.env.API_INTERNAL_BASE_URL?.trim();
  return internal && internal.length > 0 ? internal : getWebEnv().NEXT_PUBLIC_API_BASE_URL;
}
