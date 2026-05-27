/**
 * Purpose: Server-only current session loader with refresh-on-expiry support.
 * Caller: Next auth session and refresh route handlers.
 * Deps: Backend auth adapter, session mapper, and token cookie types.
 * MainFuncs: Loads principal/profile/tenant context, refreshes expired access tokens, and returns updated token/session state.
 * SideEffects: Calls backend API; callers decide cookie mutations.
 */
import 'server-only';

import { ApiError } from '@/lib/api/api-error';
import {
  backendGetCurrentTenant,
  backendGetMemberships,
  backendGetPrincipal,
  backendGetProfile,
  backendRefresh,
} from './backend-auth.server';
import type { IssuedAuthTokens } from './session-cookies.server';
import { createSessionSnapshot } from './session-mapper';
import type { SessionSnapshot } from './session-types';

export type LoadedSession = {
  session: SessionSnapshot;
  tokens?: IssuedAuthTokens;
};

export async function loadSessionWithRefresh(input: { accessToken?: string; refreshToken?: string }): Promise<LoadedSession> {
  if (!input.accessToken && !input.refreshToken) {
    throw new ApiError('Authentication is required.', 401, null);
  }

  try {
    return { session: await loadSessionFromAccessToken(requiredAccessToken(input.accessToken)) };
  } catch (error) {
    if (!shouldRefresh(error) || !input.refreshToken) {
      throw error;
    }

    const tokens = await backendRefresh(input.refreshToken);
    return {
      session: await loadSessionFromAccessToken(tokens.accessToken),
      tokens,
    };
  }
}

export async function loadSessionFromAccessToken(accessToken: string): Promise<SessionSnapshot> {
  const principal = await backendGetPrincipal(accessToken);
  const [profile, memberships, currentTenant] = await Promise.all([
    backendGetProfile(accessToken, principal.rtId),
    backendGetMemberships(accessToken, principal.rtId),
    backendGetCurrentTenant(accessToken, principal.rtId),
  ]);

  return createSessionSnapshot({
    user: profile,
    principal,
    memberships,
    currentTenant,
  });
}

function requiredAccessToken(accessToken: string | undefined): string {
  if (!accessToken) {
    throw new ApiError('Access token is missing.', 401, null);
  }
  return accessToken;
}

function shouldRefresh(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
