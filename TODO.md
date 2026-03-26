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
| [x] | Test isolation | Separate test DB (`magically_v2_test`), auto-created via Jest globalSetup. |
| [x] | Fix failing tests | All test suites updated after schema unification. 247 tests, 0 failures. |
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

## Developer Experience

| Done | Task | Description |
|------|------|-------------|
| [x] | CLI: `magically publish` | Bundle agent, upload to registry, build image async. |
| [x] | CLI: `magically status` | Check build status of a published agent. |
| [x] | CLI: `magically run` | Run an agent function via runtime API. |
| [x] | CLI: `magically login` | Browser-based OAuth login. |
| [x] | CLI: `magically init` | AI-native scaffolding: AGENTS.md, CLAUDE.md, .claude/skills/, docs/, functions/. Interactive prompts via enquirer. |
| [ ] | CLI: `magically install` | Install agent from registry. |
| [ ] | CLI: `magically logs` | View run logs for an agent. |
| [ ] | CLI: `magically secrets` | Set/get/delete secrets per agent. |
| [ ] | CLI: `magically dev` | Run runtime locally with file watching. |
| [ ] | Widget DSL React renderer | Types + template + validation exist. No renderer. |
| [ ] | Agent SDK React hooks | `useAgentData`, `useTool`, `useMemory`, `useTask` for iframe UIs. |

## UI

| Done | Task | Description |
|------|------|-------------|
| [ ] | Home grid | Show agent widgets. Fetch widget data, render via DSL renderer. |
| [ ] | Feed view | Show live feed events from agents. |
| [ ] | Agent detail view | Run history, logs, functions, trigger status. |
| [ ] | Run function from UI | Button to trigger function, see result + logs. |
| [ ] | Zeus chat | Connect chat panel to SSE endpoint. Streaming responses. |
| [ ] | Settings page | API keys, agent config, secrets management. |
| [ ] | Agent install UI | Browse registry, one-click install, permission grants. |
| [ ] | Notifications | Agent feed posts trigger notifications. |

## Infrastructure

| Done | Task | Description |
|------|------|-------------|
| [x] | BullMQ + Redis | Background job queue for async builds. |
| [x] | GitHub Actions builder | Remote Docker builds without local Docker. Pushes to GHCR + Fly. |
| [x] | Daytona compute provider | Ready for use when Tier 3+ (network restrictions on lower tiers). |
| [x] | BUILD_PROVIDER config | Explicit build provider selection: `github-actions`, `docker`, `fly`, `auto`. |
| [x] | COMPUTE_PROVIDER config | Explicit compute provider selection: `daytona`, `fly`, `docker`, `auto`. |
| [ ] | Runtime API auth | JWT or API key middleware on all endpoints. |
| [ ] | Rate limiting | Per-agent quotas for API credits and compute. |
| [ ] | Encrypt secrets at rest | `agent_secrets.value` is plaintext. |
| [ ] | Health check endpoint | `GET /health` for Fly monitoring. |
| [ ] | Structured logging | JSON logs, log aggregation. |
| [ ] | Deploy updated runtime to Fly | Current production is outdated. Needs schema migration + env vars. |

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
| [ ] | Mobile responsive | OS should work on phone screens. |
