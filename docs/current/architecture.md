# Architecture

> **Last synced**: 2026-03-28 | **Commit**: `97ab426` (development branch)

## System Overview

Magically is an operating system for AI agents. The system is a monorepo with five packages, a web frontend, and example agents.

```
Browser ──► Vite React SPA (apps/web)
               │
               ├── REST API ──► NestJS Runtime (packages/runtime)
               │                     │
               │                     ├── PostgreSQL (Neon prod / local dev)
               │                     ├── BullMQ + Redis (async build jobs)
               │                     ├── Tigris S3 (agent bundle storage)
               │                     └── Agent SDK (Zeus brain — Claude Code tools)
               │
               └── Socket.IO ──► NestJS Gateways
                                   ├── / namespace (feed, agent events)
                                   └── /zeus namespace (chat streaming)

CLI (packages/cli) ──► REST API (publish, run, status, login)
```

## Monorepo Packages

```
packages/
  runtime/     NestJS backend. All API endpoints, DB, Zeus, agent execution.
  cli/         Commander.js CLI. publish, run, status, login, init.
  shared/      Types, ApiClient, validation pipeline, errors, scaffold, Dockerfile generator.
                Plain tsc -b, CJS output. Consumed by runtime, web, and CLI.
  agent-sdk/   SDK for agent UIs (planned, not built).
  widget-dsl/  Widget spec (planned, not built).

apps/
  web/         Vite + React 19. Tailwind v4 + shadcn/ui. The user-facing SPA.

agents/        Example agents (hello-world, instagram-auto-poster).
builders/      Git submodule (rajatady/magically-builders). GitHub Actions for remote Docker builds.
```

## Package Dependency Graph

```
@magically/shared ◄── packages/runtime
                  ◄── packages/cli
                  ◄── apps/web (via Vite commonjsOptions)
```

The shared package uses **plain `tsc -b`** with CJS output. No bundler. No `"type": "module"`. Exports use `"default"` condition. Vite handles CJS→ESM at dev/build time via `optimizeDeps.include` and `build.commonjsOptions`.

## Data Flow

### Agent Publish Pipeline

```
Developer runs `magically publish .`
  └─► CLI validates manifest (RxJS validation pipeline)
      └─► CLI bundles agent directory (tar.gz)
          └─► CLI uploads bundle to Tigris S3 via POST /api/registry/publish
              └─► Runtime creates agents + agent_versions records (status: processing)
                  └─► BullMQ job enqueued for async build
                      └─► Build worker downloads bundle
                          └─► BuildProvider builds Docker image
                              ├── DockerBuildProvider (local dev)
                              ├── FlyBuildProvider (Fly registry)
                              └── GitHubActionsBuildProvider (GHCR + Fly)
                                  └─► On success: imageRef stored, status → live
                                      On failure: buildError stored, status → failed
```

### Zeus Chat Flow

```
User sends message via WebSocket (/zeus namespace)
  └─► ZeusGateway.handlePrompt()
      ├── Creates conversation if new (zeus_conversations table)
      ├── Saves user message (zeus_messages table)
      ├── Creates empty assistant message for incremental updates
      └── ZeusService.runPrompt()
          ├── ensureWorkspace() — scaffold agent template if first use
          │   └── syncWorkspaceDraft() — upsert draft agent into agents table
          ├── getMessages() — load conversation history from zeus_messages
          └── executePrompt() — runs Agent SDK query()
              ├── System prompt: claude_code preset + Zeus context
              │   ├── User context files (kumar-profile.md, career-history.md, etc.)
              │   ├── Installed agents list
              │   ├── User memory entries
              │   └── Onboarding instructions (if needed)
              ├── Tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
              ├── MCP: magically tools (ListAgents, WriteMemory, CreateTask, etc.)
              ├── stream_event → text deltas → onChunk callback → WS 'chunk' event
              ├── assistant → tool_use blocks → onToolStart → WS 'tool:start'
              ├── user → tool_result → onToolResult → WS 'tool:result'
              ├── result → cost/turns → onResult → WS 'result'
              └── Each step: incremental updateMessage() to zeus_messages table
```

**System prompt composition:** Zeus appends user context files to the `claude_code` preset via `systemPrompt.append`. This personalizes Zeus responses without requiring memory entries or configuration changes. Context files are loaded on every `runPrompt()` call, allowing for dynamic updates.

### Frontend Data Loading

```
App startup (AuthenticatedApp.tsx):
  ├── connectSocket() — global Socket.IO to / namespace
  └── Promise.allSettled([
        agents.list()  → store.setAgents()     — all live agents
        feed.list(50)  → store.setFeed()       — recent feed items
        config.get()   → store.setConfig()     — app configuration
      ])

Per-page:
  /gallery       → agents.mine()              — user's agents (draft + live) + all local agents
  /zeus/:chatId  → zeus.getConversation(id)   — past messages
  /agents/:id    → iframes to /api/agents/:id/ui
```

### Local Agent Discovery on Boot (2026-04-04)

```
Runtime starts (NestJS OnApplicationBootstrap)
  └─► LocalDiscoveryService.onApplicationBootstrap()
      └─► Scan agents/ directory for manifest.json files
          └─► For each valid manifest:
              ├── Upsert row in agents table (source: 'local', status: 'live')
              └── If agent already existed as source: 'remote' → update source to 'local'

No agent_versions rows are created for local agents.
Functions are read at request time from filesystem via LocalRunnerService.loadManifest().
```

Local agents are immediately available via `GET /api/agents/me` after startup — no publish pipeline required.

---

### Agent Data Flow (2026-04-04)

```
Agent function runs (via `magically dev` or container execution)
  └─► ctx.emit('feed', { type, title, body })
  │     └─► POST /api/feed
  │           └─► feed_events table
  │                 ├─► Home screen live ticker (latest event, pulsing dot)
  │                 ├─► Feed view (/feed)
  │                 └─► Zeus ReadFeed MCP tool
  │
  └─► ctx.emit('widget', { size, html })
        └─► POST /api/widgets (upsert by userId + agentId)
              └─► user_widgets table
                    ├─► Home screen widget grid (12-col, renders raw HTML)
                    └─► Zeus ReadWidgets MCP tool
```

The agent owns presentation entirely: widget HTML includes inline CSS, inline SVG charts, and any visual content. The home screen renders widgets via `dangerouslySetInnerHTML` in a responsive grid (small=4col, medium=6col, large=8col).

Zeus can read both feed events and widgets via MCP tools (`ReadFeed`, `ReadWidgets`), giving it awareness of what agents have reported and what the user sees on their home screen.

---

## Key Architectural Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Monorepo module resolution | Plain tsc -b, CJS, `"default"` exports | Only setup that works across NestJS (CJS), Vite (ESM), and Jest (CJS) |
| Zeus brain | Claude Agent SDK (`query()`) | Full Claude Code tool suite out of the box + MCP for custom tools |
| Agent execution | Docker containers + env vars + stdout | Language-agnostic. No SDK required. Works in Python, Go, Rust, anything. |
| Build pipeline | Async via BullMQ | Builds take minutes. CLI polls status. No blocking. |
| Real-time | Socket.IO (not raw WebSocket) | Namespaces, rooms, auto-reconnect, fallback to polling |
| Frontend state | Zustand (not Redux, not Context) | Simple, no boilerplate, works outside React (socket listeners) |
| CSS | Tailwind v4 + shadcn/ui | Utility-first, dark-only theme, component primitives |
| Auth | JWT + API keys + query token | JWT for browser, API key for CLI/programmatic, query token for iframes |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `GOOGLE_CLIENT_ID` | For OAuth | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For OAuth | Google OAuth client secret |
| `AWS_ACCESS_KEY_ID` | For publish | Tigris S3 access key |
| `AWS_SECRET_ACCESS_KEY` | For publish | Tigris S3 secret key |
| `AWS_ENDPOINT_URL_S3` | For publish | Tigris S3 endpoint URL |
| `AWS_REGION` | No | S3 region (default: `auto`) |
| `REDIS_URL` | For builds | Redis URL for BullMQ (default: `redis://localhost:6379`) |
| `GITHUB_BUILDER_REPO` | For GH Actions builds | Builder repository (owner/repo) |
| `GITHUB_BUILDER_TOKEN` | For GH Actions builds | GitHub PAT for dispatching builder workflow |
| `RUNTIME_URL` | For OAuth | Runtime base URL for OAuth callbacks (default: `http://localhost:4321`) |
| `WEB_URL` | For CORS/OAuth | Web app URL for CORS origins and OAuth redirects (default: `http://localhost:5173`) |
| `COMPUTE_PROVIDER` | No | `docker`, `fly`, `daytona`, or `auto` (default: auto) |
| `BUILD_PROVIDER` | No | `docker`, `fly`, `github-actions`, or `auto` (default: auto) |
| `DATA_DIR` | No | Workspace root. Default: `/data` (prod), `~/.magically` (dev) |
| `ANTHROPIC_API_KEY` | For Zeus | Claude API key for Agent SDK (read by SDK from env) |
