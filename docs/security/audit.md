<!--
Purpose: Production npm audit triage record for JIMPITAN dependency advisories.
Caller: Release operators, maintainers, CI reviewers, and Codex agents handling dependency security work.
Deps: package.json, package-lock.json, docs/production-readiness.md, docs/production-readiness/README.md.
MainFuncs: Records advisory reachability, production exploitability, mitigation status, safe upgrade guidance, and temporary risk acceptance.
SideEffects: None.
-->

# Production NPM Audit

Audit scope: `npm audit --omit=dev` for production dependencies after the Prisma patch on 2026-05-27.

## Resolved Advisory

| Advisory | Path | Status | Classification |
| --- | --- | --- | --- |
| `effect <3.20.0`, GHSA-38f7-945m-qr2g | `prisma -> @prisma/config -> effect` | Resolved by `prisma` and `@prisma/client` `6.19.3`; lockfile resolves `effect` to `3.21.0`. | Fixed before public launch |

Exploitability in this architecture: Prisma CLI/config code is not imported by API, worker, or web request handlers. Before patching, runtime exposure was limited to trusted operator commands such as migration or Prisma generation inside controlled build/deploy contexts.

Production exploitability after patch: not exploitable through the production request path.

Upgrade safety: safe because `prisma` and `@prisma/client` were upgraded together on the same `6.19.3` line. No Prisma major upgrade was introduced.

## Accepted Temporary Risk

| Advisory | Path | Status | Classification |
| --- | --- | --- | --- |
| `postcss <8.5.10`, GHSA-qx2v-qp2m-jg93 | `next@16.2.6 -> postcss@8.4.31` | Temporarily accepted. Next remains on stable `16.2.6`; no canary upgrade and no forced downgrade were applied. | Acceptable temporary risk |

Exploitability in this architecture: the advisory requires user-controlled CSS parsed and stringified into an HTML `<style>` context. Current app source has no user CSS editor, no app-level PostCSS runtime import, and no raw HTML rendering path identified for this advisory.

Production exploitability: not currently exploitable through documented product flows. Risk can increase if future features accept user CSS, rich HTML, markdown with raw HTML, custom themes, or untrusted PostCSS plugins.

Runtime reachability: not reachable from app request handlers by direct source import. The affected package is pulled through Next internals and should be treated as build/runtime dependency hygiene until Next publishes a stable patched release.

Mitigation:
- Do not add user-controlled CSS or raw HTML rendering without a sanitizer and security review.
- Keep React default escaping behavior; avoid `dangerouslySetInnerHTML` for untrusted data.
- Do not run `npm audit fix --force`, because the suggested Next downgrade is incompatible with the current App Router/React 19 stack.
- Do not move to a Next canary solely for this advisory before compatibility testing.
- Monitor stable Next releases for `postcss >=8.5.10`, then upgrade Next and `eslint-config-next` together.

Safe upgrade plan for the remaining PostCSS advisory:

```bash
npm install next@<stable-patched-version> eslint-config-next@<same-stable-version> --package-lock-only
npm ci
npm run typecheck:web
npm run build:web
npm run test:web
npm audit --omit=dev
```
