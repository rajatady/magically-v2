# Magically v2 — TODO

## Critical

| Done | Task | Description |
|------|------|-------------|
| [ ] | Authentication | Config API is completely open. Add auth middleware (API keys or JWT) before production. |
| [ ] | Agent install/uninstall at runtime | Currently filesystem-scan only. Can't add/remove agents without restart. Need registry-backed install. |
| [ ] | Agent registry | No way to publish, discover, or pull agents. Need DB-backed registry with versioning. |
| [ ] | Secrets management API | Table exists, no endpoints. Need CRUD API for per-agent secrets. |

## High Priority

| Done | Task | Description |
|------|------|-------------|
| [ ] | Run tracking API | `agent_runs` table populated but no endpoints. Need `GET /agents/:id/runs` and `GET /runs/:runId`. |
| [ ] | Persistent storage for container agents | Stateless containers lose data between runs. Need volume or S3/R2 per agent. |
| [ ] | Event triggers | Schema exists, not wired. Agents can't react to other agents' events. |
| [ ] | Webhook triggers | Schema exists, not wired. No HTTP endpoint per agent for external callers. |
| [ ] | Composability | Agents can't call other agents' functions. Zeus should discover and invoke them. |
| [ ] | Container harness | Typed function interface inside containers. Currently raw commands only. |

## Developer Experience

| Done | Task | Description |
|------|------|-------------|
| [ ] | CLI: `magically init` | Scaffold new agent from template. |
| [ ] | CLI: `magically install` | Install agent from registry. |
| [ ] | CLI: `magically publish` | Publish agent to registry. |
| [ ] | CLI: `magically logs` | View run logs for an agent. |
| [ ] | CLI: `magically secrets` | Set/get/delete secrets per agent. |
| [ ] | CLI: `magically dev` | Run runtime locally with file watching. |
| [ ] | Per-agent database | Isolated storage per agent. Currently shared platform DB. |
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
| [ ] | Mobile responsive | OS should work on phone screens. |

## Infrastructure

| Done | Task | Description |
|------|------|-------------|
| [ ] | Runtime API auth | JWT or API key middleware on all endpoints. |
| [ ] | Rate limiting | Per-agent quotas for API credits and compute. |
| [ ] | Encrypt secrets at rest | `agent_secrets.value` is plaintext. |
| [ ] | Health check endpoint | `GET /health` for Fly monitoring. |
| [ ] | Daytona compute provider | Third provider subclass alongside Docker and Fly. |
| [ ] | Agent image caching | Don't rebuild Docker images every run. Cache by manifest hash. |
| [ ] | Structured logging | JSON logs, log aggregation (Axiom, Grafana). |
| [ ] | DB connection pooling | Tune pg Pool for production. |

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
