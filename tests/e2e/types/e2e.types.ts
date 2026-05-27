/**
 * Purpose: Shared contracts for deterministic Playwright E2E tests.
 * Caller: tests/e2e support modules and critical journey specs.
 * Deps: Playwright runtime conventions and JIMPITAN API route contracts.
 * MainFuncs: Defines journey identifiers, runtime config, seeded fixture handles, API helper shapes, and journey matrix.
 * SideEffects: None.
 */

export type CriticalJourneyId =
  | "login"
  | "create-read-area"
  | "create-read-house"
  | "create-read-resident"
  | "create-per-house-session"
  | "input-collection-item"
  | "submit-and-validate-session"
  | "post-collection-to-finance"
  | "create-bulk-total-session"
  | "submit-bulk-total"
  | "validate-and-post-bulk-total"
  | "public-report-page"
  | "export-csv";

export type SmokeTargetId =
  | "api-health"
  | "api-ready"
  | "web-health"
  | "public-report"
  | "telegram-webhook";

export interface E2ERuntimeConfig {
  readonly runId: string;
  readonly webBaseUrl: string;
  readonly apiBaseUrl: string;
  readonly databaseUrl: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
  readonly bendaharaEmail: string;
  readonly bendaharaPassword: string;
  readonly telegramSecretToken?: string;
}

export interface E2ESeedFixture {
  readonly runId: string;
  readonly tenantId: string;
  readonly rtId: string;
  readonly adminUserId: string;
  readonly ketuaUserId: string;
  readonly bendaharaUserId: string;
  readonly officerUserId: string;
  readonly bendaharaMembershipId: string;
  readonly officerMembershipId: string;
  readonly areaId: string;
  readonly houseId: string;
  readonly residentId: string;
  readonly cashAccountId: string;
  readonly incomeCategoryId: string;
  readonly privateLeakSentinels: readonly string[];
  readonly publicReportSlug: string;
}

export interface CriticalJourneySpec {
  readonly id: CriticalJourneyId;
  readonly title: string;
  readonly requiresTelegramSecret: boolean;
}

export interface E2EApiClient {
  readonly config: E2ERuntimeConfig;
  authenticate(): Promise<void>;
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  expectStatus(path: string, status: number): Promise<void>;
  cleanupRun(runId: string): Promise<void>;
}

export function buildCriticalJourneySpecs(): readonly CriticalJourneySpec[] {
  return [
    { id: "login", title: "login", requiresTelegramSecret: false },
    { id: "create-read-area", title: "create and read area", requiresTelegramSecret: false },
    { id: "create-read-house", title: "create and read house", requiresTelegramSecret: false },
    { id: "create-read-resident", title: "create and read resident", requiresTelegramSecret: false },
    { id: "create-per-house-session", title: "create PER_HOUSE jimpitan session", requiresTelegramSecret: false },
    { id: "input-collection-item", title: "input collection item", requiresTelegramSecret: false },
    { id: "submit-and-validate-session", title: "submit and validate session", requiresTelegramSecret: false },
    { id: "post-collection-to-finance", title: "post collection to finance", requiresTelegramSecret: false },
    { id: "create-bulk-total-session", title: "create BULK_TOTAL session", requiresTelegramSecret: false },
    { id: "submit-bulk-total", title: "submit total", requiresTelegramSecret: false },
    { id: "validate-and-post-bulk-total", title: "validate and post BULK_TOTAL", requiresTelegramSecret: false },
    { id: "public-report-page", title: "public report page loads safely", requiresTelegramSecret: false },
    { id: "export-csv", title: "export CSV request and download", requiresTelegramSecret: false },
  ];
}
