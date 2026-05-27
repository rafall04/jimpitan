/**
 * Purpose: Deployment verification before or after VPS rollout.
 * Caller: npm run deploy:verify and future CI/manual release workflows.
 * Deps: readiness-check, smoke-check, production Compose config, health endpoints, and backup scripts.
 * MainFuncs: Runs static launch gates and optional full build/test verification for VPS deployment.
 * SideEffects: Calls local npm/Docker commands and reads runtime health endpoints when smoke env is configured.
 */

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const DEPLOYMENT_VERIFY_CONTRACT = Object.freeze({
  phases: [
    "static-infra-check",
    "docker-compose-config",
    "prisma-validate",
    "application-builds",
    "unit-tests",
    "smoke-tests",
    "backup-script-check",
  ],
});

export async function runDeploymentVerification() {
  const commands = [
    ["npm", ["run", "readiness:check"]],
    ["npm", ["run", "infra:check"]],
    ["npm", ["run", "prisma:validate"]],
    ["npm", ["run", "scan:imports"]],
  ];

  if (process.env.DEPLOY_VERIFY_FULL === "true") {
    commands.push(
      ["npm", ["run", "build:api"]],
      ["npm", ["run", "build:web"]],
      ["npm", ["run", "test:api"]],
      ["npm", ["run", "test:web"]],
      ["npm", ["run", "typecheck:web"]],
    );
  } else {
    console.warn("WARN full build/test verification skipped; set DEPLOY_VERIFY_FULL=true.");
  }

  for (const [command, args] of commands) {
    runCommand(command, args);
  }

  if (isDockerAvailable()) {
    runCommand("npm", ["run", "docker:config:prod"]);
  } else {
    console.warn("WARN Docker CLI unavailable; run docker compose config manually on the deployment host.");
  }

  runCommand("npm", ["run", "test:smoke"]);
  console.log("Deployment verification command completed.");
}

function runCommand(command, args) {
  const executable = command === "npm" && process.platform === "win32" ? "npm.cmd" : command;
  const result = spawnSync(executable, args, { stdio: "inherit", shell: false });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isDockerAvailable() {
  const executable = process.platform === "win32" ? "docker.exe" : "docker";
  const result = spawnSync(executable, ["--version"], { stdio: "ignore", shell: false });
  return result.status === 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runDeploymentVerification();
}
