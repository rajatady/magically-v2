- Package manager: bun

## Project Snapshot

Magically is an operating system for AI agents. Not a chatbot. Not a developer tool. An OS — like iOS for your AI life.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that
can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided.
Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Process Rules

**These exist because we burned 12+ hours debugging cascading breakages. Follow them exactly.**

1. **Think before changing.** Read the code. Understand why it's written that way. If something looks wrong, check git blame before "fixing" it — it may be intentional.
2. **Never rewrite a file from scratch.** Edit the minimum lines needed. When you rewrite, you lose context (test fixtures, edge cases, specific values) that existed for a reason.
3. **One concern per commit.** Don't mix a feature change with a type cleanup with a test fix. When something breaks, you can't tell which change caused it.
4. **Verify the full blast radius.** A change to `packages/shared` affects runtime, CLI, and web. A change to a `.spec.ts` affects jest AND bun test. A tsconfig change affects tsc, jest (via ts-jest), and the Docker build. Check all consumers, not just the one you're working in.
5. **Never push to main to "see if CI catches it."** CI is the last safety net, not the first. Run the verification checklist locally.
6. **When a test fails, read the test first.** Understand what it asserts and why. Don't change the test to make it pass — fix the code. If the test is genuinely wrong, explain why before changing it.
7. **Don't chase type purity at the cost of stability.** Replacing `as any` with `as unknown as Record<string, unknown>` is not safer — it's the same bypass with more characters. Either fix the type properly (module augmentation, Zod inference, interface extension) or leave the `any` and move on.
8. **Infrastructure is not the product.** Monorepo config, CI, module resolution — these are solved problems. Copy from a working reference (vndevteam/nestjs-turbo, t3code). Don't invent.

## Verification Checklist — MANDATORY before every commit

**You MUST run ALL of these and see zero failures before committing. No exceptions.**

```bash
# 1. Typecheck runtime (catches type errors that Jest/bun miss)
cd packages/runtime && npx tsc --noEmit

# 2. Runtime unit tests (fast, parallel)
npx jest

# 3. Runtime e2e tests (sequential, hits DB)
npx jest --config test/jest-e2e.json --runInBand --forceExit

# 4. Web tests
cd ../../apps/web && bunx vitest run

# 5. CLI tests
cd ../../packages/cli && npx jest --no-coverage --testPathIgnorePatterns=dist

# 6. Shared typecheck (no build output, just verify)
cd ../../packages/shared && npx tsc --noEmit

# 7. Full monorepo bun test (catches cross-package issues)
cd ../.. && bun test
```

If ANY of these fail, fix it before committing. Do not assume "it's pre-existing" or "it only fails on CI."

- Package manager: bun

## Monorepo Module Resolution — DO NOT CHANGE

The shared package (`@magically/shared`) uses **plain `tsc -b`** with CJS output. This is the only configuration that works across all consumers. **Do not touch this setup.**

- **No `"type": "module"`** in shared's package.json — output must be CJS
- **No tsup, esbuild, or any bundler** for shared — plain `tsc -b` only
- **Exports use `"default"` condition** (not `"import"` + `"require"` split) — both Vite and NestJS resolve via `"default"`
- **Vite needs `optimizeDeps.include`** for shared subpaths + `build.commonjsOptions` to handle CJS→ESM at build time
- **All tsconfigs use `Node16` module/resolution** from `tsconfig.base.json`
- **The Dockerfile must COPY and BUILD shared** before building runtime
- **Vercel's `buildCommand` must build shared** before building web
- Reference: `vndevteam/nestjs-turbo` — this is the pattern we follow

If a new subpath export is added to shared, update: `package.json` exports, rebuild shared (`tsc -b`), and verify both `npx tsc --noEmit` in runtime AND `vite build` in web still work.

## Test Architecture

- **Unit tests** (`src/**/*.spec.ts`): run in parallel via `jest`. No DB access, mock everything.
- **Integration tests** (`test/**/*.spec.ts`): run sequentially via `jest --runInBand --forceExit`. Hit real Postgres DB.
- **Web tests** (`apps/web`): run via `vitest run`. DOM tests use jsdom environment.
- **CI runs both**: `bun run test` (unit) + `bun run test:e2e` (integration, sequential)
- **DB integration tests import from `../src/`** — paths were remapped when moved from `src/` to `test/`
- **jest.mock for Node builtins** — Node 22 makes ESM namespace properties non-configurable. Never use `jest.spyOn(childProcess, 'execSync')`. Always use top-level `jest.mock('child_process', () => ({ execSync: jest.fn() }))`.
- **jest.mock calls must be top-level** — Jest hoists them via babel transform. Wrapping in `if` blocks breaks hoisting.
- **CLI tests exclude `dist/`** — `--testPathIgnorePatterns=dist` prevents running stale compiled specs

## `bun test` vs `jest` vs `vitest`

Three different test runners coexist. Know which runs where:

| Runner | Runs | Notes |
|---|---|---|
| `bun test` (root) | All `*.spec.ts` and `*.test.ts` across monorepo | Bun's native runner. No `jest.mock`, no `vi.mock`. Some tests skip via `describe.skip`. |
| `jest` (runtime, cli) | `packages/runtime/src/**/*.spec.ts` + `test/**/*.spec.ts` | Supports `jest.mock`, `jest.requireActual`. Uses `ts-jest`. |
| `vitest` (web) | `apps/web/src/**/*.test.ts` + `*.spec.tsx` | Supports `vi.mock`, jsdom. Run via `bunx vitest run`. |

Tests that need module mocking (`jest.mock`/`vi.mock`) must skip under bun: `const isBun = typeof Bun !== 'undefined'; const maybeDescribe = isBun ? describe.skip : describe;`

## Deployment

- **Runtime** deploys to Fly.io via `flyctl deploy`. The `Dockerfile` at repo root builds shared + runtime. `fly.toml` `release_command` runs migrations.
- **Web** deploys to Vercel. `apps/web/vercel.json` `buildCommand` builds shared first, then web.
- **Production DB** is Neon Postgres. Drizzle migrations track state in `__drizzle_migrations` table. If migration fails with "already exists", the journal is out of sync — wipe DB or manually insert journal entries.
- **`docker info` timeout**: `DockerProvider.isAvailable()` has a 5s timeout on `execSync('docker info')`. Without this, CI hangs.

## Architecture Overview

```
packages/
  runtime/     — NestJS backend. Agents, Zeus, registry, build pipeline, compute providers.
  cli/         — Commander.js CLI. publish, run, status, login.
  shared/      — Types, errors, validation pipeline, harness, dockerfile generator. Plain tsc, CJS output.
  web/         — Vite + React frontend. Tailwind v4 + shadcn/ui.
  agent-sdk/   — SDK for agent UIs (planned).
  widget-dsl/  — Widget spec (planned).
agents/        — Example agents (hello-world, instagram-auto-poster).
builders/      — Git submodule (rajatady/magically-builders). GitHub Actions workflow for remote Docker builds.
```

## Key Systems

- **Single `agents` table** — no separate registry table. `agent_versions` stores per-version manifest, imageRef, bundleUrl.
- **Publish pipeline**: CLI validates → bundles → Tigris → BullMQ → GitHub Actions builds image → GHCR + Fly registry.
- **Compute providers**: `COMPUTE_PROVIDER` env — Fly (production), Docker (dev), Daytona (future).
- **Build providers**: `BUILD_PROVIDER` env — GitHub Actions (production), Docker (dev).
- **Container harness**: `_harness.js` injected at publish time. Calls `module.exports` JS functions with proper `ctx`.
- **Validation**: RxJS Observable pipeline in `packages/shared/src/validation/`. Runs in CLI + runtime.
- **Errors**: `MagicallyError` hierarchy in `packages/shared/src/errors/`. Never leaks vendor names.
- **Test DB**: `magically_v2_test`, separate from dev DB. Jest `globalSetup` reads `DATABASE_URL` env var, falls back to local default.
- **Express Request augmentation**: `src/auth/authenticated-request.d.ts` adds `user` property to Express `Request`. No `as any` casts needed in controllers.
- **AgentManifest type**: Exported from `@magically/shared/validation`. Use instead of `as any` for manifest JSONB fields. Uses `.passthrough()` so extra fields exist at runtime.

## Key Docs

- `STYLE_GUIDE.md` — Coding patterns, provider pattern, database, auth, CLI, validation, error handling.
- `TODO.md` — Prioritized task list with completion status.
- `README.md` — Non-technical overview for end users.
- `docs/architecture/` — Phase-by-phase architecture plans (some outdated, being updated).
