# Magically v2 — TODO

## Critical

| Done | Task | Description |
|------|------|-------------|
| [x] | Authentication | Google OAuth + email/password, JWT, API keys, global guard, CLI login flow. |
| [x] | Agent registry | Publish, discover, install agents. Single `agents` table + `agent_versions`. |
| [x] | Async publish pipeline | CLI bundles → Tigris → BullMQ → GitHub Actions builds → GHCR + Fly registry. |
| [x] | Container execution | Fly Machines + Docker locally. Daytona provider ready for future use. |
| [x] | Container harness | `_harness.js` injected at publish time. Calls `module.exports` functions with ctx. |
| [x] | Validation pipeline | RxJS Observable pipeline. Checks: manifest, schema, functions, secrets. |
| [x] | Error hierarchy | `MagicallyError` base + domain subclasses. No vendor leaks in user messages. |
| [x] | Test isolation | Separate test DB (`magically_v2_test`), auto-created via Jest globalSetup. Unit/e2e split. |
| [x] | Fix failing tests | All test suites pass. Unit (parallel) + e2e (sequential --runInBand). |
| [ ] | Secrets management API | Table exists, no endpoints. Need CRUD API for per-agent secrets. |

## High Priority

| Done | Task | Description |
|------|------|-------------|
| [ ] | Run tracking API | `agent_runs` table populated but no endpoints. Need `GET /agents/:id/runs` and `GET /runs/:runId`. |
| [ ] | Fly image cache invalidation | Same version tag = stale image. Need build hash in tag or cache bust. |
| [ ] | Auto-bump version on re-publish | Server should bump patch if same version exists. |
| [ ] | Event triggers | Schema exists, not wired. Agents can't react to other agents' events. |
| [ ] | Webhook triggers | Schema exists, not wired. No HTTP endpoint per agent for external callers. |
| [ ] | Composability | Agents can't call other agents' functions. Zeus should discover and invoke them. |

## Zeus / Agent SDK

| Done | Task | Description |
|------|------|-------------|
| [x] | Agent SDK integration | Zeus uses `@anthropic-ai/claude-agent-sdk` query() with full Claude Code tools. |
| [x] | MCP tools | ListAgents, GetAgent, ReadMemory, WriteMemory, DeleteMemory, CreateTask, ListTasks. |
| [x] | WebSocket gateway | Socket.IO `/zeus` namespace. JWT auth, streaming events, interrupt support. |
| [x] | Session persistence | agentSessionId stored, resume on reconnect, conversation history fallback. |
| [x] | Agent template scaffold | `packages/shared/templates/agent/` — 17 real files. `scaffoldAgent()` utility. |
| [x] | Workspace bootstrap | On first Zeus message, scaffold agent template into user workspace. |
| [x] | Onboarding flow | `/onboard` skill fills manifest identity. System prompt detects `.magically/onboarded` marker. |
| [x] | Block tree rendering | Text + tool call blocks in UI. Collapsible tool display with icons. |
| [x] | URL routing | `/zeus` and `/zeus/:chatId` — panel syncs with URL, refresh preserves session. |
| [ ] | `zeus_messages` table | Replace JSONB blob with proper messages table. Pagination, proper IDs. |
| [ ] | Per-user workspace volumes | Fly.io persistent volumes per user. Currently shared `~/.magically/workspaces/{userId}/`. |
| [ ] | PublishAgent MCP tool | Wire `magically publish .` or registry API as MCP tool for Zeus. |
| [ ] | Composability via Zeus | Zeus discovers + invokes other agents' functions. Cross-agent orchestration. |
| [ ] | Chat history sidebar | List past conversations in Zeus panel. Navigate between them. |

## UI

| Done | Task | Description |
|------|------|-------------|
| [x] | Tailwind v4 + shadcn/ui | All components migrated from inline styles. Tailwind theme tokens. |
| [x] | Error boundary | Wraps entire app. Retry button. Styled with Tailwind. |
| [x] | Loading states | ProtectedRoute spinner, AuthenticatedApp skeleton. |
| [x] | Zeus chat panel | WebSocket streaming, block tree, tool display, Streamdown markdown. |
| [x] | Agent gallery | Dreamer-inspired. My Agents + Explore tabs. Gradient icon cards. 50 dummy agents. |
| [x] | Agent detail page | Apple App Store style. Gradient hero, stats ribbon, features, functions, info table. |
| [x] | Socket lifecycle | disconnectSocket on logout + unmount. |
| [ ] | Home grid | Show agent widgets. Fetch widget data, render via DSL renderer. |
| [ ] | Feed view | Show live feed events from agents (basic view exists, not wired to real data). |
| [ ] | Settings page | API keys, agent config, secrets management. |
| [ ] | Notifications | Agent feed posts trigger notifications. |
| [ ] | Mobile responsive | OS should work on phone screens. |

## Developer Experience

| Done | Task | Description |
|------|------|-------------|
| [x] | CLI: `magically publish` | Bundle agent, upload to registry, build image async. |
| [x] | CLI: `magically status` | Check build status of a published agent. |
| [x] | CLI: `magically run` | Run an agent function via runtime API. |
| [x] | CLI: `magically login` | Browser-based OAuth login. |
| [x] | CLI: `magically init` | AI-native scaffolding. Uses shared templates (to be wired). |
| [x] | Agent templates | Real files at `packages/shared/templates/agent/`. Skills, docs, manifest, functions. |
| [ ] | CLI uses shared templates | Refactor `init.ts` to use `scaffoldAgent()` from `@magically/shared/scaffold`. |
| [ ] | CLI: `magically install` | Install agent from registry. |
| [ ] | CLI: `magically logs` | View run logs for an agent. |
| [ ] | CLI: `magically secrets` | Set/get/delete secrets per agent. |
| [ ] | CLI: `magically dev` | Run runtime locally with file watching. |
| [ ] | Widget DSL React renderer | Types + template + validation exist. No renderer. |
| [ ] | Agent SDK React hooks | `useAgentData`, `useTool`, `useMemory`, `useTask` for iframe UIs. |

## Infrastructure

| Done | Task | Description |
|------|------|-------------|
| [x] | BullMQ + Redis | Background job queue for async builds. |
| [x] | GitHub Actions builder | Remote Docker builds without local Docker. Pushes to GHCR + Fly. |
| [x] | Daytona compute provider | Ready for use when Tier 3+ (network restrictions on lower tiers). |
| [x] | BUILD_PROVIDER config | Explicit build provider selection: `github-actions`, `docker`, `fly`, `auto`. |
| [x] | COMPUTE_PROVIDER config | Explicit compute provider selection: `daytona`, `fly`, `docker`, `auto`. |
| [x] | Shared package (CJS) | `tsc -b`, CJS output, `"default"` exports. Vite `commonjsOptions` bridge. |
| [x] | CI pipeline | GitHub Actions: build shared, unit tests, e2e tests (sequential), CLI tests, web tests. |
| [x] | Deploy: Runtime to Fly | Dockerfile copies + builds shared. `fly.toml` release_command runs migrations. |
| [x] | Deploy: Web to Vercel | `vercel.json` buildCommand builds shared first. SPA rewrites. |
| [ ] | Runtime API auth | JWT or API key middleware on all endpoints. |
| [ ] | Rate limiting | Per-agent quotas for API credits and compute. |
| [ ] | Encrypt secrets at rest | `agent_secrets.value` is plaintext. |
| [ ] | Health check endpoint | `GET /health` for Fly monitoring. |
| [ ] | Structured logging | JSON logs, log aggregation. |

## Future

| Done | Task | Description |
|------|------|-------------|
| [ ] | Remix/fork agents | `magically remix <agent>` forks into workspace. |
| [ ] | Agent versioning + migrations | Schema changes between versions, auto data migration. |
| [ ] | Agent signing | Cryptographic hash for tamper detection. |
| [ ] | Monetization | Agent pricing, subscriptions, revenue share, billing. |
| [ ] | Chrome extension trigger | Share content from browser to agent. |
| [ ] | Email input trigger | Forward email to agent's address. |
| [ ] | Feed RSS/podcast | Audio feed items as podcast feed. |
| [ ] | macOS native shell | Swift + WKWebView, system tray, hotkeys. |
| [ ] | iOS app | WKWebView + push + share extension + widgets. |
| [ ] | Cross-platform | Windows/Linux (Tauri), Android (Kotlin WebView). |
| [ ] | Per-agent database | Isolated storage per agent. Currently shared platform DB. |
