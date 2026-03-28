# Magically — Style Guide & Design Principles

## TDD

Write tests first, implement second. No exceptions. Non-tautological tests — test behavior, not implementation details.

## NestJS & OOP

- Use classes, decorators, interfaces everywhere. This is a NestJS application, not a Node.js script with NestJS bolted on.
- Dependency injection via decorators (`@Injectable`, `@Inject`, custom decorators like `@InjectDB`).
- Every service is `@Injectable`. Never manually instantiate services.
- Use `OnModuleInit`, `OnModuleDestroy` lifecycle hooks where appropriate.

## Abstract Provider Pattern

All platform services that can have multiple implementations MUST use abstract class + provider subclasses:
- `ComputeProvider` → `DockerProvider`, `FlyProvider`, `DaytonaProvider`
- `BuildProvider` → `DockerBuildProvider`, `FlyBuildProvider`, `GitHubActionsBuildProvider`
- Same pattern for: storage, LLM, notifications, and any future service

Provider selection is explicit via env vars (`COMPUTE_PROVIDER`, `BUILD_PROVIDER`) or `auto` for priority-based fallback.

Only agents with a `runtime` block in their manifest use compute/build providers.

## Imports

- No `.js` extensions in imports. Use bare relative paths: `./schema` not `./schema.js`.
- Use barrel exports (`index.ts`) for modules: `import { InjectDB, DrizzleDB } from '../db'`.
- TypeScript resolves via `moduleResolution: Node` in the runtime tsconfig.

## Shared Types & API Client

- **Shared types** between backend, frontend, and CLI live in a shared package or are exported from the runtime.
- **API calls** must be defined once and shared across web, CLI, and any other consumer. Don't duplicate fetch logic.
- Create a `packages/api-client` or similar shared package for:
  - Type definitions (agent, feed, config, auth, runs)
  - API methods (list agents, run function, login, etc.)
  - Auth header injection
- Web, CLI, and future platforms import from this shared package.

## Database

- PostgreSQL via Drizzle ORM. Local Postgres for dev, Neon for production.
- Separate test DB: `magically_v2_test`, auto-created + migrated via Jest `globalSetup`.
- Schema defined in `packages/runtime/src/db/schema.ts` using `pgTable`.
- Migrations via `drizzle-kit`: `bun run db:generate`, `bun run db:migrate`. Use `db:push` for destructive resets.
- Schema WILL change frequently. Use migrations, not manual SQL.
- Custom `@InjectDB()` decorator for injecting the Drizzle client.
- `DRIZZLE` symbol token for NestJS DI.
- **Single `agents` table** — no separate registry table. `agent_versions` stores per-version data (manifest, imageRef, bundleUrl, buildError).

## Authentication

- Three auth methods: Bearer JWT, X-API-Key header, query param `?token=` (for iframes).
- Global `AuthGuard` on all routes. Use `@Public()` decorator to exempt routes.
- API keys prefixed with `mg_`, hashed with SHA256, stored in `api_keys` table.
- JWTs signed with `JWT_SECRET`, 7-day expiry.
- Google OAuth as primary login, email/password as secondary.

## Agent Manifest

- Agents declare everything in `manifest.json`: identity, triggers, functions, runtime, secrets, config schema.
- Triggers are a typed array — each trigger maps to a specific function entrypoint.
- Functions with a `run` field specify the command to execute in containers.
- `runtime` block present → container agent. Absent → lightweight in-process agent.
- `secrets` array declares what the agent needs. Only declared secrets are injected.

## Compute Execution

- Container agents (has `runtime`): run via compute provider (Docker locally, Fly Machines in prod, Daytona in future).
- JS functions using `module.exports` are called via injected `_harness.js` which constructs `ctx` from env vars.
- Python/other scripts run directly as commands.
- The runtime is the scheduler and orchestrator. It triggers, injects context, captures results.
- Every invocation is logged in `agent_runs` table with status, duration, logs, result.

## Publish Pipeline

- `magically publish` validates (RxJS pipeline), bundles (tar.gz), uploads to Tigris, enqueues BullMQ job.
- Build worker downloads bundle, builds Docker image via `BuildProvider`, stores imageRef in `agent_versions`.
- GitHub Actions builds remotely (no local Docker needed). Pushes to GHCR + Fly registry.
- Status: `processing → building → live | failed`. Developer polls via `magically status`.

## Agent HTTP API Contract

- Container agents receive env vars: `MAGICALLY_AGENT_ID`, `MAGICALLY_FUNCTION`, `MAGICALLY_TRIGGER`, plus declared secrets.
- JS agents get a full `ctx` object via `_harness.js` with `log`, `emit`, `secrets`, `agentDir`.
- Python/other agents read env vars directly and print JSON to stdout.
- No SDK required — just env vars + stdout. Works in Python, Rust, Go, Node, anything.

## Frontend

- Vite + React 19. Tailwind v4 + shadcn/ui for styling. CSS variables for theming tokens (defined in `@theme` block of `global.css`).
- Use `cn()` from `@/lib/utils` for conditional class merging.
- Extract component logic to `.logic.ts` files with corresponding `.logic.test.ts` tests.
- Use shadcn UI primitives (`Button`, `Input`, `Badge`, `Skeleton`, `Spinner`, `Tabs`, `Card`, `Avatar`, `ScrollArea`, etc.) instead of custom elements.
- `ErrorBoundary` wraps the entire app. `TooltipProvider` at root for shadcn tooltips.
- Zustand for state management.
- React Router for routing. Protected routes via `ProtectedRoute` component.
- Auth state persisted to localStorage via `useAuthStore`. Synchronous init from localStorage.
- Use `@magically/shared` `ApiClient` for ALL API calls. Never use raw `fetch()` in components or hooks.
- Socket.IO for real-time: events gateway on `/` namespace, Zeus gateway on `/zeus` namespace.
- Zeus chat: WebSocket via `useZeusSocket` hook. Block tree rendering (text + tool calls). Session resume via Agent SDK.
- Gallery: Dreamer-inspired gradient cards. `AgentCard`, `AgentDetail` components. No hard borders on cards.
- `AgentImage` wrapper for all images — controls loading, fallback, future CDN switching.
- URL routing for Zeus: `/zeus` and `/zeus/:chatId`. Panel state syncs with URL.

## CLI

- Commander.js for command parsing.
- Credentials stored in `~/.magically/credentials.json`.
- `magically login` opens browser for OAuth, local server catches callback.
- `magically login --token <key>` for direct API key login.
- `magically publish [dir]` — validate, bundle, upload, build image async. `--validate-only` flag.
- `magically status <agentId>` — check build status.
- `magically run <agentId> <fn>` — execute a function via the runtime API.
- All commands read auth token and send with requests.
- CLI is used by both humans and AI agents — structured output, JSON payloads, predictable exit codes.

## Git & CI

- No AI attribution in commits. Ever.
- GitHub Actions: CI runs tests with Postgres service container. Deploy Runtime and Deploy Web trigger only after CI passes.
- Runtime deploys to Fly.io (`magically-runtime`). Web deploys to Vercel.
- Agent images built via `rajatady/magically-builders` GitHub Actions workflow → GHCR + Fly registry.
- Builder repo is a git submodule at `./builders`.

## Error Handling

- All errors extend `MagicallyError` from `packages/shared/src/errors/`.
- Domain-specific subclasses: publish, build, compute, registry, auth.
- Never leak implementation details (no vendor names, no internal URLs) in user-facing messages.
- `toJSON()` for API responses. `toLog()` for server-side logging with full details.

## Validation

- Validation pipeline in `packages/shared/src/validation/` — framework-agnostic, works in CLI + runtime.
- Checks are RxJS Observables: `(context) → Observable<CheckResult>`.
- Pipeline supports short-circuit on fatal errors, streaming for real-time progress, phase filtering.
- Each check declares: `id`, `name`, `severity` (error/warning/info), `phase` (pre-upload/pre-build/post-build), `category`.
- Add new checks by implementing `ValidationCheck` interface. No registration needed — add to the pipeline factory.

## Naming

- Zeus = the orchestrator (formerly Sidekick). The kernel of the OS.
- Agent = an app. Has UI, functions, triggers, state.
- Tool = a stateless capability. Typed interface. Used by agents.
- Widget = declarative JSON for the home grid. Not React.

## Don't Over-Engineer

- Build one thing end-to-end before designing the system.
- Concrete implementation over abstract design. Ship, then generalize.
- If a decision can be deferred, defer it.
- Three lines of similar code is better than a premature abstraction.
