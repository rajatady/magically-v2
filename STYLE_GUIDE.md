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
- Same pattern for: storage, LLM, notifications, and any future service

Only agents with a `runtime` block in their manifest use compute providers. Lightweight agents run in-process.

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
- Schema defined in `packages/runtime/src/db/schema.ts` using `pgTable`.
- Migrations via `drizzle-kit`: `bun run db:generate`, `bun run db:migrate`.
- Schema WILL change frequently. Use migrations, not manual SQL.
- Custom `@InjectDB()` decorator for injecting the Drizzle client.
- `DRIZZLE` symbol token for NestJS DI.

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

- Lightweight agents (no `runtime`): run in-process via `require()` + `ctx`.
- Container agents (has `runtime`): run via compute provider (Docker locally, Fly Machines in prod).
- The runtime is the scheduler and orchestrator. It triggers, injects context, captures results.
- Every invocation is logged in `agent_runs` table with status, duration, logs, result.

## Agent HTTP API Contract

- Container agents communicate with the runtime via HTTP, not `ctx`.
- Runtime injects `MAGICALLY_API` env var pointing to a scoped endpoint.
- Agent code in any language hits that URL for config, secrets, feed, memory, tools.
- No SDK required — just HTTP. Works in Python, Rust, Go, Node, anything.

## Frontend

- Vite + React 19. No Tailwind — CSS variables for theming.
- Zustand for state management.
- React Router for routing. Protected routes via `ProtectedRoute` component.
- Auth state persisted to localStorage via `useAuthStore`.
- API client auto-injects auth headers. Redirects to `/login` on 401.

## CLI

- Commander.js for command parsing.
- Credentials stored in `~/.magically/credentials.json`.
- `magically login` opens browser for OAuth, local server catches callback.
- `magically login --token <key>` for direct API key login.
- All commands read auth token and send with requests.
- CLI is used by both humans and AI agents — structured output, JSON payloads, predictable exit codes.

## Git & CI

- No AI attribution in commits. Ever.
- GitHub Actions: CI runs tests with Postgres service container. Deploy Runtime and Deploy Web trigger only after CI passes.
- Runtime deploys to Fly.io (`magically-runtime`). Web deploys to Vercel.
- Agent container images pushed to Fly registry via `magically push`.

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
