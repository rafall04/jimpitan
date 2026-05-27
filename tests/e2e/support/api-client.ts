/**
 * Purpose: API helper boundary for E2E setup, validation, and cleanup calls.
 * Caller: Playwright journey specs and fixture helpers.
 * Deps: E2E runtime config and JIMPITAN REST API endpoints.
 * MainFuncs: Authenticates test principals and wraps deterministic API calls.
 * SideEffects: Sends HTTP requests to the configured test API.
 */

import type { E2EApiClient, E2ERuntimeConfig } from "../types/e2e.types";

export function createE2EApiClient(config: E2ERuntimeConfig): E2EApiClient {
  let accessToken: string | null = null;
  let rtId: string | null = null;

  async function request<T>(method: string, path: string, body?: unknown, expectedStatus?: number): Promise<T> {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    if (rtId) {
      headers.set("X-Tenant-Id", rtId);
    }
    const response = await fetch(joinApiUrl(config.apiBaseUrl, path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (expectedStatus !== undefined) {
      if (response.status !== expectedStatus) {
        throw new Error(`${method} ${path} returned ${response.status}, expected ${expectedStatus}.`);
      }
      return undefined as T;
    }
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${path} returned ${response.status}: ${text}`);
    }
    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    return (text && contentType.includes("application/json") ? JSON.parse(text) : text) as T;
  }

  return {
    config,
    async authenticate() {
      const result = await request<{ tokens: { accessToken: string }; principal: { rtId: string } }>("POST", "auth/login", {
        identifier: config.bendaharaEmail,
        password: config.bendaharaPassword,
      });
      accessToken = result.tokens.accessToken;
      rtId = result.principal.rtId;
    },
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    patch: (path, body) => request("PATCH", path, body),
    put: (path, body) => request("PUT", path, body),
    expectStatus: (path, status) => request("GET", path, undefined, status),
    cleanupRun: async () => undefined,
  };
}

function joinApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\/+/, ""), normalizedBase).toString();
}
