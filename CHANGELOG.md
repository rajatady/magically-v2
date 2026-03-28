# Changelog

All notable changes to this project are documented here. Format: date, git hash, summary.

---

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
