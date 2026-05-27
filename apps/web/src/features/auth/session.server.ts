/**
 * Purpose: Server-only reader for non-sensitive auth session metadata.
 * Caller: Dashboard App Router layout.
 * Deps: Next.js cookies, Zod, and session type definitions.
 * MainFuncs: Safely decodes session metadata cookies without exposing tokens to client code.
 * SideEffects: Reads request cookies.
 */
import 'server-only';

import { cookies } from 'next/headers';
import { z } from 'zod';
import { SESSION_META_COOKIE, type SessionSnapshot } from './session-types';

const tenantSessionSchema = z.object({
  id: z.string(),
  rtId: z.string(),
  rtCode: z.string(),
  rtName: z.string(),
  roleNames: z.array(z.string()),
  permissions: z.array(z.string()),
  isDefault: z.boolean().optional(),
});

const sessionSnapshotSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email().nullable(),
    status: z.string().optional(),
  }),
  activeTenantId: z.string().optional(),
  tenants: z.array(tenantSessionSchema),
});

export async function readSessionSnapshot(): Promise<SessionSnapshot | null> {
  const store = await cookies();
  const raw = store.get(SESSION_META_COOKIE)?.value;
  if (!raw) {
    return null;
  }

  const decoded = decodeSessionCookie(raw);
  if (!decoded) {
    return null;
  }

  const parsed = sessionSnapshotSchema.safeParse(decoded);
  return parsed.success ? parsed.data : null;
}

function decodeSessionCookie(raw: string): unknown | null {
  const candidates = [raw, decodeURIComponent(raw)];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
