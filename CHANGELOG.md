# Changelog

All notable changes to this project are documented here. Format: date, git hash, summary.

---

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
