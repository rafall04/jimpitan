<!--
Purpose: Launch-facing production readiness summary for dependency security and release gates.
Caller: Release operators, maintainers, CI reviewers, and Codex agents before public launch decisions.
Deps: docs/security/audit.md, docs/production-readiness/README.md, package.json, package-lock.json.
MainFuncs: Summarizes launch gates, dependency advisory status, accepted temporary risk, and verification commands.
SideEffects: None.
-->

# Production Readiness Summary

## Dependency Security Status

- Prisma production advisory is patched with `prisma` and `@prisma/client` pinned to `6.19.3`.
- Next remains on stable `16.2.6`; no Next canary upgrade was applied.
- PostCSS (via Next) and the NestJS/multer/js-yaml advisory cluster are documented accepted temporary risks in `docs/security/audit.md` (re-triaged 2026-06-22).
- `npm audit fix --force` is not approved for this stack because it proposes an incompatible Next downgrade.

## Launch Checklist

- Run production dependency audit with `npm audit --omit=dev`.
- Confirm production audit advisories match the accepted set in `docs/security/audit.md` (PostCSS plus the NestJS/multer/js-yaml cluster). CI hard-fails on any new **critical** advisory via `npm audit --omit=dev --audit-level=critical`.
- Confirm `package-lock.json` keeps `prisma`, `@prisma/client`, and `@prisma/config` on `6.19.3` and `effect` at or above `3.20.0`.
- Confirm `next` remains on the approved stable line and is not downgraded or moved to canary without explicit compatibility testing.
- Keep user-controlled CSS, raw HTML, raw markdown HTML, and untrusted PostCSS plugins out of public launch scope.
- Re-run the full launch gate before public release: Prisma validate/generate, API build, worker build, web build, API tests, web tests, web typecheck, import scan, infra check, readiness check, and production audit.

## Public Launch Rule

Public launch can proceed with the temporary PostCSS risk only while the product does not accept or render user-controlled CSS/raw HTML and a stable patched Next release is not available. Revisit this decision when Next publishes a stable release carrying `postcss >=8.5.10`.
