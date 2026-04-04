# Changelog

All notable changes to this project are documented here. Format: date, git hash, summary.

---

## 2026-04-05 | Worker thread agent execution

- Agent functions now run in `worker_threads` instead of in-process
- `agent-worker.js` — standalone worker script that loads and runs agent functions
- Main NestJS event loop stays unblocked during long-running agents (e.g. 14s Python pipelines)
- WebSocket connections, API requests, and other agents continue working during execution
- Emit/log messages passed from worker to main thread via `postMessage`
- Removed old `buildContext()` from LocalRunnerService — context built in worker

## 2026-04-04 (9) | Agent registration gate + RegisterAgent tool

- LocalRunnerService.run() checks agent is registered in DB before executing (prevents FK violations)
- POST /api/agents/register/:id — register a local agent on demand
- CLI: `magically register <agentId>` — register via API
- Zeus tool: RegisterAgent — register agents from conversation
- LocalDiscoveryService.register() — single-agent registration method
- Clear error message when agent not registered: "Run 'magically register' first"

## 2026-04-04 (8) | Zeus user context injection

- Zeus system prompt now includes user context files (profile, career history, research interests, job search strategy)
- Files read from `/Users/kumardivyarajat/WebstormProjects/job-search/context/` on every conversation
- `buildZeusContext()` includes `loadUserContext()` — reads 4 markdown files inline
- Zeus now knows who the user is, their goals, constraints, and timeline

## 2026-04-04 (7) | Electron fixes: auth persistence, chat input, socket

- `persist:magically` partition — localStorage survives app restarts
- Zeus WebSocket uses `VITE_API_URL` instead of relative `/zeus` (fixes `file://` protocol)
- `titleBarStyle: 'hidden'` with `trafficLightPosition` (fixes `hiddenInset` focus bug)

## 2026-04-04 (6) | Desktop polish + sidebar chats link

- Added `/chats` nav item to sidebar
- `bun run desktop` — one command: builds shared, web, copies, launches Electron
- `bun run desktop:dev` — quick launch with existing web-dist

## 2026-04-04 (5) | Electron desktop app

- Electron shell wrapping the bundled React app + NestJS backend
- Backend starts as child process, skips if already running on port 4321
- Hidden title bar (macOS native), system tray for background operation
- HashRouter for file:// protocol, relative asset paths via `--base './'`
- `apps/desktop/` — main.js, package.json, .gitignore

## 2026-04-04 (4) | Local agents visible in gallery + discovery fixes

- LocalDiscoveryService updates existing remote agents to `source: 'local'` when found on filesystem
- `AgentWithManifest` includes `source` field, propagated through all service methods
- `findAll`/`findByAuthor`/`findOne` handle local agents without `agent_versions` rows
- `GET /api/agents/me` returns local agents with functions read from filesystem manifest
- Gallery "My Agents" tab now renders local agents (fixed `useMemo` dependency)
- `hasWidget: true` for all local agents

## 2026-04-04 (3) | New agents: runway monitor, research pulse

- Runway Monitor agent: calculates weeks remaining, progress bar, milestone tracker, urgency levels (normal/warning/critical)
- Research Pulse agent: reads research context files, shows experiment count, publications, research tracks (Neural Genome, Spatial Intelligence, Interpretability), strengths/gaps

## 2026-04-04 (2) | Local execution, scheduling, Zeus agent tools

- `LocalRunnerService`: run agent functions in-process from filesystem (150ms vs 26s Fly)
- `LocalDiscoveryService`: auto-register local agents in DB on boot (`source: 'local'` column)
- Unified `POST /api/agents/:id/run/:fn` — local agents run in-process, published agents run in containers
- `user_schedules` table (migration 0005): per-user cron schedules with enable/disable/CRUD
- `agents.source` column (migration 0006): distinguish `'local'` vs `'remote'` agent origin
- Schedule API: `GET/POST /api/schedules`, `PUT /:id/toggle`, `PUT /:id/cron`, `DELETE /:id`
- Scheduler reads from `user_schedules` table (user-controlled), not from manifests (auto)
- Zeus tools: `RunAgent`, `ListLocalAgents`, `ListSchedules`, `CreateSchedule`, `ToggleSchedule`, `DeleteSchedule`

## 2026-04-04 | Local agent runtime, widgets, home screen

- `magically dev <fn> [dir]` — run agent functions locally, no Docker/server/publish needed
- Agents emit widgets via `ctx.emit('widget', { size, html })` — agent owns presentation, emits raw HTML with data baked in
- Agents emit feed events via `ctx.emit('feed', { type, title, body })` — persisted to `feed_events` table
- `user_widgets` table (migration 0004) — per-user widget state, upserted by agentId
- Widget API: `GET /api/widgets`, `POST /api/widgets`, `DELETE /api/widgets/:agentId`
- Home screen rewrite: 12-column grid, mesh gradient background, live feed ticker, personalized greeting, staggered animations
- Zeus MCP tools: `ReadFeed` (read agent events), `ReadWidgets` (read user's home screen)
- New agent: `job-search-tracker` — reads jobs.tsv, emits donut chart widget with pipeline status
- Updated agent: `instagram-auto-poster/fetchInsights` — parses insights, emits sparkline chart widget with follower/engagement data
- Updated agent: `hello-world/greet` — emits small greeting widget
- Shared: `UserWidget` type, `widgets.list()`/`widgets.remove()` in ApiClient
- Fixed instagram manifest secret mismatch (`IG_ACCESS_TOKEN` → `IG_CT_ACCESS_TOKEN`)

## 2026-04-03 | Central chat system + file attachments + API enhancements

- Central chat routes: `/chats` (conversation list), `/chat/new` (create + redirect), `/chat/:id` (full-page chat)
- Page components: `ChatPage`, `ChatsPage`, `NewChatPage` — handle document title/metadata, delegate to client components
- Shared chat components: `ChatHeader` (configurable title/icon/connection dot), `ChatInput` (with file attachments), `ChatMessages`, `ChatView` — used by both Zeus panel and full-page chat
- Zeus panel (`ZeusChat`) now delegates to shared `ChatView` with zeus-specific props
- File attachments: drag & drop, paste images, file picker, XHR upload with progress, file chips with cancel
- File upload backend: `POST /api/uploads` → Tigris S3 (`magically-v2-uploads` bucket, separate from registry)
- File processing: `downloadToBase64()` → SDK content blocks (image/document/text) — ported from cc-harness
- `files` column added to `zeus_messages` table (migration 0003)
- Incremental persistence at SDK batch boundaries (assistant events, tool results) — not per-delta. Logged errors instead of `.catch(() => {})`
- `PATCH /api/zeus/conversations/:id` — update conversation title
- `GET /api/zeus/conversations` — now accepts `?limit=&offset=&search=` query params, filtered by userId
- Conversations now store `userId` on creation (multi-tenant)
- `ChatConfig` interface: `TOP_LEVEL_CHAT_CONFIG` (full tools, MCP, $1 budget) vs `AGENT_SCOPED_CHAT_CONFIG` (restricted, no MCP, $0.25)
- Executor refactored: `ExecutorZeusDelegate` and `ExecutorAgentsDelegate` interfaces, zero `unknown`/`any`
- Reconnecting indicator: yellow pulsing dot when socket reconnecting
- Error retry button in chat messages
- Shared types: `FileAttachment`, `ConversationSummary`, `ConversationMessage`, `ConversationWithMessages`
- ApiClient: `listConversations()` accepts `{ limit, offset, search }`, added `updateConversation()`
- Tests: 67 runtime (13 new executor + 6 new service), 79 web (17 new chat components + pages)

## 2026-03-28 | `e0e5cb4` | Documentation overhaul + gallery redesign + zeus messages table

- Created 12 comprehensive docs in `docs/current/` covering architecture, database, API, WebSockets, auth, Zeus, agents, frontend, CLI, shared package, testing, deployment
- Redesigned agent gallery: editorial luxury aesthetic, hero story cards, parallax detail page, sticky glass nav
- Added URL routing for all views (`/gallery`, `/gallery/explore`, `/gallery/:agentId`, `/feed`, `/agents/:agentId`, `/settings`, `/build`)
- Added `zeus_messages` table replacing JSONB blob — incremental persistence during streaming
- Added `GET /api/agents/me` — returns authenticated user's agents (drafts + live)
- Workspace draft agents sync to `agents` table on Zeus prompt (atomic upsert)
- Zeus panel overlays without replacing current page URL
- Search in gallery now matches name, description, and category
- Fixed cursor-pointer on all interactive elements
- Responsive breakpoints across gallery and detail page
- Stats ribbon: 3 cols mobile, 4 cols tablet, 5 cols desktop

## 2026-03-27 | `cb74ccd` | Gallery + templates + onboarding

- Redesigned agent gallery: Dreamer-inspired gradient cards, Apple App Store detail page
- 50 dummy agents generated for Explore tab
- Extracted agent templates from CLI into `packages/shared/templates/agent/` (17 files)
- `scaffoldAgent()` utility in shared package
- Onboarding flow: `.magically/onboarded` marker, system prompt detects and prompts identity fill

## 2026-03-26 | `4d692cb` | Zeus Agent SDK + WebSocket + frontend chat

- Replaced Vercel AI SDK with Claude Agent SDK for Zeus
- Zeus executor with Agent SDK `query()`, full Claude Code tool suite
- MCP tools: ListAgents, GetAgent, ReadMemory, WriteMemory, DeleteMemory, CreateTask, ListTasks
- Socket.IO WebSocket gateway on `/zeus` namespace with JWT auth
- Frontend Zeus chat with block tree rendering (text + tool calls)
- Session persistence: agentSessionId stored, resume on reconnect
- URL routing: `/zeus` and `/zeus/:chatId`

## 2026-03-25 | `0aa80a9` | CI fixes + test isolation

- Separated unit and e2e tests (parallel vs sequential)
- Fixed jest.mock hoisting (must be top-level, not inside if blocks)
- Fixed Node 22 ESM compat (jest.mock for child_process instead of jest.spyOn)
- Fixed Docker build provider test fixtures
- Fixed function-runner 5s timeout for docker info
- Fixed DB globalSetup to read DATABASE_URL env var
- Added Express Request augmentation (authenticated-request.d.ts)

## 2026-03-24 | `e60efb4` | Deploy fixes

- Fixed Vercel deploy: build shared before web
- Fixed Docker deploy: include shared package in Dockerfile
- Fixed CLI publish spec for Node 22

## 2026-03-23 | Earlier commits | Foundation

- Authentication: Google OAuth + email/password, JWT, API keys, global guard
- Agent registry: publish, discover, install agents
- Async publish pipeline: CLI → Tigris → BullMQ → GitHub Actions → GHCR
- Container execution: Fly Machines + Docker locally
- Validation pipeline: RxJS Observable checks
- Error hierarchy: MagicallyError base + domain subclasses
- Tailwind v4 + shadcn/ui migration
- Error boundary, loading states, socket lifecycle
