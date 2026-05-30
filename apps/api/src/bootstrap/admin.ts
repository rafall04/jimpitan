/**
 * Purpose: CLI entrypoint for first-admin production bootstrap.
 * Caller: npm run bootstrap:admin inside the API container.
 * Deps: NestFactory, AdminBootstrapModule, AdminBootstrapService, input parser, and runtime logging.
 * MainFuncs: Builds an application context, executes bootstrap once, prints non-secret outcome, and exits with a shell status.
 * SideEffects: Connects to PostgreSQL and creates bootstrap records when safety checks pass.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AdminBootstrapInputError, parseAdminBootstrapInput } from './admin-bootstrap.input';
import { AdminBootstrapSafetyError, AdminBootstrapService } from './admin-bootstrap.service';
import { resolveLogLevels } from '../runtime/logging';

async function main(): Promise<void> {
  const input = parseAdminBootstrapInput(process.argv.slice(2));
  const { AdminBootstrapModule } = await import('./admin-bootstrap.module.js');
  const app = await NestFactory.createApplicationContext(AdminBootstrapModule, { bufferLogs: true, logger: resolveLogLevels() });
  try {
    const service = app.get(AdminBootstrapService);
    const result = await service.execute(input);
    console.log(`First admin bootstrap completed for ${result.adminEmail} in tenant ${result.tenantSlug}.`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  if (error instanceof AdminBootstrapInputError || error instanceof AdminBootstrapSafetyError) {
    console.error(error.message);
  } else if (error instanceof Error) {
    console.error(`First admin bootstrap failed: ${error.message}`);
  } else {
    console.error('First admin bootstrap failed with an unknown error.');
  }
  process.exitCode = 1;
});
