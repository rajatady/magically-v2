- All of `bun test` must pass before considering tasks completed.
- Package manager: bun

## Project Snapshot

Magically is an operating system for AI agents. Not a chatbot. Not a developer tool. An OS — like iOS for your AI life.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Architecture Overview

```
packages/
  runtime/     — NestJS backend. Agents, Zeus, registry, build pipeline, compute providers.
  cli/         — Commander.js CLI. publish, run, status, login.
  shared/      — Types, errors, validation pipeline, harness, dockerfile generator.
  web/         — Vite + React frontend (basic shell).
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
- **Test DB**: `magically_v2_test`, separate from dev DB. Jest `globalSetup` creates + migrates it.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that
can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided.
Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Key Docs

- `STYLE_GUIDE.md` — Coding patterns, provider pattern, database, auth, CLI, validation, error handling.
- `TODO.md` — Prioritized task list with completion status.
- `README.md` — Non-technical overview for end users.
- `docs/architecture/` — Phase-by-phase architecture plans (some outdated, being updated).
