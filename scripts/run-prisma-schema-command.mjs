/**
 * Purpose: Run Prisma schema-only commands with a safe placeholder database URL when none is configured.
 * Caller: npm run prisma:generate and npm run prisma:validate.
 * Deps: Node.js child_process and local Prisma CLI.
 * MainFuncs: Executes Prisma generate/validate against prisma/schema.prisma without requiring a real database secret.
 * SideEffects: Prisma generate writes generated client files; validate only reads schema.
 */
import { spawnSync } from 'node:child_process';

const command = process.argv[2];
const allowed = new Set(['generate', 'validate']);

if (!allowed.has(command)) {
  console.error('usage: node scripts/run-prisma-schema-command.mjs <generate|validate>');
  process.exit(2);
}

const executable = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';
const result = spawnSync(executable, [command, '--schema', 'prisma/schema.prisma'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://jimpitan:jimpitan@localhost:5432/jimpitan?schema=public',
  },
});

process.exit(result.status ?? 1);
