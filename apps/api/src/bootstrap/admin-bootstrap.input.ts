/**
 * Purpose: Parse and validate first-admin bootstrap input.
 * Caller: Admin bootstrap CLI entrypoint and unit tests.
 * Deps: Node.js process environment and CLI argument conventions.
 * MainFuncs: Resolves env/CLI values, normalizes identity fields, validates password strength, and detects force mode.
 * SideEffects: None.
 */
export type AdminBootstrapInput = {
  adminEmail: string;
  adminPassword: string;
  adminName: string;
  tenantName: string;
  tenantSlug: string;
  force: boolean;
};

type EnvLike = Record<string, string | undefined>;

const CLI_KEYS = {
  '--admin-email': 'ADMIN_EMAIL',
  '--admin-password': 'ADMIN_PASSWORD',
  '--admin-name': 'ADMIN_NAME',
  '--tenant-name': 'TENANT_NAME',
  '--tenant-slug': 'TENANT_SLUG',
} as const;

type BootstrapEnvKey = (typeof CLI_KEYS)[keyof typeof CLI_KEYS];

export class AdminBootstrapInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminBootstrapInputError';
  }
}

export function parseAdminBootstrapInput(argv: string[], env: EnvLike = process.env): AdminBootstrapInput {
  const cli = parseCliArgs(argv);
  const adminEmail = normalizeEmail(resolveValue('ADMIN_EMAIL', cli, env));
  const adminPassword = resolveValue('ADMIN_PASSWORD', cli, env);
  const adminName = normalizeName(resolveValue('ADMIN_NAME', cli, env), 'ADMIN_NAME');
  const tenantName = normalizeName(resolveValue('TENANT_NAME', cli, env), 'TENANT_NAME');
  const tenantSlug = normalizeTenantSlug(resolveValue('TENANT_SLUG', cli, env));

  validatePasswordStrength(adminPassword, { adminEmail, adminName, tenantName, tenantSlug });

  return {
    adminEmail,
    adminPassword,
    adminName,
    tenantName,
    tenantSlug,
    force: cli.FORCE === 'true',
  };
}

function parseCliArgs(argv: string[]): EnvLike & { FORCE?: 'true' } {
  const values: EnvLike & { FORCE?: 'true' } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--force') {
      values.FORCE = 'true';
      continue;
    }

    const [rawKey, inlineValue] = arg.split('=', 2);
    const envKey = CLI_KEYS[rawKey as keyof typeof CLI_KEYS];
    if (!envKey) {
      throw new AdminBootstrapInputError(`Unknown bootstrap argument: ${rawKey}`);
    }

    const value = inlineValue ?? argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new AdminBootstrapInputError(`${envKey} is required.`);
    }
    values[envKey] = value;
    if (inlineValue === undefined) {
      index += 1;
    }
  }
  return values;
}

function resolveValue(key: BootstrapEnvKey, cli: EnvLike, env: EnvLike): string {
  const value = cli[key] ?? env[key];
  if (!value?.trim()) {
    throw new AdminBootstrapInputError(`${key} is required.`);
  }
  return value.trim();
}

function normalizeEmail(value: string): string {
  const email = value.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new AdminBootstrapInputError('ADMIN_EMAIL must be a valid email address.');
  }
  return email;
}

function normalizeName(value: string, key: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length < 2 || normalized.length > 120) {
    throw new AdminBootstrapInputError(`${key} must be 2-120 characters.`);
  }
  return normalized;
}

function normalizeTenantSlug(value: string): string {
  const slug = value.toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/.test(slug)) {
    throw new AdminBootstrapInputError('TENANT_SLUG must be 2-40 lowercase letters, numbers, dashes, or underscores.');
  }
  return slug;
}

function validatePasswordStrength(password: string, context: { adminEmail: string; adminName: string; tenantName: string; tenantSlug: string }): void {
  const failures = [
    password.length >= 12,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
    !/\s/.test(password),
  ];
  const lower = password.toLowerCase();
  const forbiddenFragments = [
    context.adminEmail.split('@')[0],
    context.adminName,
    context.tenantName,
    context.tenantSlug,
  ]
    .map((value) => value.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter((value) => value.length >= 4);
  if (failures.some((passed) => !passed) || forbiddenFragments.some((fragment) => lower.replace(/[^a-z0-9]/g, '').includes(fragment))) {
    throw new AdminBootstrapInputError('ADMIN_PASSWORD must be at least 12 characters and include uppercase, lowercase, number, symbol, no spaces, and no obvious admin or tenant terms.');
  }
}
