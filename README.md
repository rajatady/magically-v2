# Magically

**Your personal Agent OS.**

Magically is an operating system for AI agents. Not a chatbot. Not a developer tool. An OS — like iOS for your AI life.

You install agents like apps. They run in the background, do things for you, and show you what happened. A home screen with widgets shows you everything at a glance. A feed shows what your agents did while you were away. And Zeus — the kernel — orchestrates it all.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS (TypeScript) |
| Frontend | Vite + React 19 |
| Database | PostgreSQL (Neon prod, local dev) |
| ORM | Drizzle ORM |
| Job Queue | BullMQ + Redis |
| Storage | Tigris S3 (agent bundles) |
| AI | Claude Agent SDK (Zeus brain) |
| Styling | Tailwind v4 + shadcn/ui |
| Fonts | DM Sans (body) + Instrument Serif (display) + JetBrains Mono (code) |
| CLI | Commander.js |
| Package Manager | Bun |

---

## Quick Start

```bash
bun install
cp .env.example .env                    # fill in DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
cd packages/shared && bun run build     # build shared package (CJS)
cd ../runtime && bun run db:migrate     # apply database migrations
bun run start:dev                       # start NestJS backend (port 4321)
cd ../../apps/web && bun run dev        # start Vite frontend (port 5173)
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/current/architecture.md) | System overview, monorepo packages, data flow diagrams, env vars |
| [Database](docs/current/database.md) | All 13 tables with every column, type, constraint. Migration history |
| [API Reference](docs/current/api.md) | All 39 REST endpoints across 6 controllers with request/response shapes |
| [WebSockets](docs/current/websockets.md) | Both gateways (/ and /zeus), every event, payloads, connection lifecycle |
| [Authentication](docs/current/auth.md) | JWT, API keys, query tokens, Google OAuth, guards, Express augmentation |
| [Zeus](docs/current/zeus.md) | Agent SDK executor, MCP tools, session management, message persistence, system prompt |
| [Agents](docs/current/agents.md) | Manifest, lifecycle, compute/build providers, publish pipeline, validation, templates |
| [Frontend](docs/current/frontend.md) | All 12 routes, components, Zustand stores, theme tokens, Zeus chat architecture |
| [CLI](docs/current/cli.md) | All 10 commands with flags, credential storage, publish flow |
| [Shared Package](docs/current/shared-package.md) | 8 subpath exports, types, ApiClient, errors, validation, scaffold |
| [Testing](docs/current/testing.md) | 3 test runners, DB setup, mocking patterns, CI pipeline |
| [Deployment](docs/current/deployment.md) | Fly.io, Vercel, Neon, GitHub Actions CI/CD, Dockerfile, env vars |
| [Changelog](CHANGELOG.md) | Feature history with git hashes and dates |

---

## Project Structure

```
packages/
  runtime/       NestJS backend — agents, Zeus, registry, build pipeline, compute
  cli/           Commander.js CLI — publish, run, status, login, init
  shared/        Types, ApiClient, validation, errors, scaffold (plain tsc, CJS)
  agent-sdk/     SDK for agent UIs (planned)
  widget-dsl/    Widget spec (planned)
apps/
  web/           Vite + React SPA — gallery, feed, Zeus chat, agent views
agents/          Example agents (hello-world, instagram-auto-poster)
builders/        Git submodule for GitHub Actions remote Docker builds
docs/
  current/       Comprehensive documentation (12 files, ~3900 lines)
```

---

## Scripts

| Command | Where | Description |
|---------|-------|-------------|
| `bun install` | Root | Install all dependencies |
| `bun run build` | `packages/shared` | Build shared package (required before runtime/web) |
| `bun run start:dev` | `packages/runtime` | Start NestJS dev server (port 4321) |
| `bun run dev` | `apps/web` | Start Vite dev server (port 5173) |
| `bun run db:generate` | `packages/runtime` | Generate new Drizzle migration |
| `bun run db:migrate` | `packages/runtime` | Apply pending migrations |
| `bun run db:push` | `packages/runtime` | Destructive schema push (dev only) |
| `npx jest` | `packages/runtime` | Run unit tests |
| `npx jest --config test/jest-e2e.json --runInBand --forceExit` | `packages/runtime` | Run e2e tests |
| `bunx vitest run` | `apps/web` | Run web tests |
| `bun test` | Root | Run all tests across monorepo |

---

## Environment Variables

```env
DATABASE_URL=postgresql://localhost:5432/magically_v2
JWT_SECRET=your-secret-here
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AWS_ACCESS_KEY_ID=...              # Tigris S3
AWS_SECRET_ACCESS_KEY=...          # Tigris S3
AWS_ENDPOINT_URL_S3=...            # Tigris S3 endpoint
REDIS_URL=redis://localhost:6379   # BullMQ
RUNTIME_URL=http://localhost:4321  # OAuth callbacks
WEB_URL=http://localhost:5173      # CORS + OAuth redirects
```

See [Architecture > Environment Variables](docs/current/architecture.md#environment-variables) for the full list.

---

## What Works Today

- [x] **Zeus** — AI kernel with Claude Agent SDK, full Claude Code tools, MCP integration, WebSocket streaming
- [x] **Gallery** — My Agents (from API) + Explore (editorial layout), agent detail with parallax scroll
- [x] **Authentication** — Google OAuth, email/password, JWT, API keys, global guard
- [x] **Agent Registry** — Publish, discover, install agents. Async build pipeline via BullMQ
- [x] **Container Execution** — Fly Machines (prod), Docker (dev), Daytona (future)
- [x] **Validation Pipeline** — RxJS Observable checks at publish time
- [x] **CLI** — publish, run, status, login, init commands
- [x] **Feed** — Real-time activity feed from agents
- [x] **URL Routing** — Every view has a URL, back button works, deep links work
- [x] **Responsive** — Mobile, tablet, desktop breakpoints

---

## Deployment

| Service | Purpose | Target |
|---------|---------|--------|
| [Fly.io](https://fly.io) | NestJS runtime | `magically-runtime` |
| [Vercel](https://vercel.com) | React web app | Auto-deploy from git |
| [Neon](https://neon.tech) | PostgreSQL database | Serverless Postgres |
| [Tigris](https://tigris.dev) | Agent bundle storage | S3-compatible |
| [Redis](https://redis.io) | BullMQ job queue | Fly Redis or Upstash |
| [GHCR](https://ghcr.io) | Agent Docker images | GitHub Container Registry |

See [Deployment docs](docs/current/deployment.md) for full setup.

---

## Documentation Version

> **Last synced**: 2026-03-28 | **Commit**: `97ab426` (development branch)
>
> | Metric | Value |
> |--------|-------|
> | Frontend Routes | 12 |
> | REST Endpoints | 39 |
> | WebSocket Events | 13 |
> | DB Tables | 13 |
> | Migrations | 3 |
> | Doc Files | 12 |
> | Doc Lines | ~4,100 |
> | Test Files | 44 |

---

## License

Private.
