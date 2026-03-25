# Magically v2 — TODO

## Critical (blocks everything)

- [ ] **Authentication** — Config API is completely open. Anyone can read/write API keys. Add auth middleware (API keys or JWT) before anything goes to production.
- [ ] **Agent install/uninstall at runtime** — Currently agents are scanned from filesystem at startup. Can't add, remove, or update agents without restarting the runtime. Need a registry-backed install flow.
- [ ] **Agent registry** — No way to publish, discover, or pull agents. Agents are just folders. Need a registry (DB-backed initially, package registry later) where agents can be stored, versioned, and retrieved.
- [ ] **Secrets management API** — Table exists (`agent_secrets`), no endpoints to set/get/delete secrets per agent. Users need a way to configure agent secrets via UI or CLI.

## High Priority (needed for usable product)

- [ ] **Run tracking API** — `agent_runs` table is populated but no endpoints to list/view runs. Need `GET /api/agents/:id/runs` and `GET /api/runs/:runId` for the UI to show run history, logs, and results.
- [ ] **Persistent storage for container agents** — Container agents are stateless. Coding-tips-pro's `posts.tsv`, `analytics.db`, and rendered content are lost between runs. Need a volume or external store (S3/R2) mounted per agent.
- [ ] **Event triggers** — Schema exists (`EventTriggerSchema`), not wired. Agents can't react to other agents' events. Need `EventEmitter2` wiring so when agent A emits an event, agent B's function fires.
- [ ] **Webhook triggers** — Schema exists (`WebhookTriggerSchema`), not wired. No HTTP endpoint per agent for external callers (e.g., GitHub webhooks, Stripe events).
- [ ] **Composability** — Agents can't call other agents' functions. Zeus should be able to discover agent functions and invoke them. This is the Unix pipes model — the core value proposition.
- [ ] **Container harness** — Typed function interface inside containers. Currently container agents run raw commands (`python insights.py`). The harness would provide a typed input/output contract between the runtime and the container.

## Medium Priority (needed for developer experience)

- [ ] **CLI: `magically init`** — Scaffold a new agent from a template. Generates manifest.json, functions/, ui/, widget.json.
- [ ] **CLI: `magically install <agent>`** — Install an agent from the registry.
- [ ] **CLI: `magically publish`** — Publish an agent to the registry.
- [ ] **CLI: `magically logs <agentId>`** — View run logs for an agent.
- [ ] **CLI: `magically secrets set <agentId> <key> <value>`** — Set secrets for an agent.
- [ ] **CLI: `magically dev`** — Run runtime locally with file watching, auto-reload agents on change.
- [ ] **Per-agent database** — Each agent should have isolated storage. Currently they share the platform DB via `agent_secrets` and `agent_runs`. Heavy agents may need their own tables or a separate DB.
- [ ] **Widget DSL React renderer** — Types + template engine + validation exist. No actual React renderer for the home grid.
- [ ] **Agent SDK React hooks** — `useAgentData`, `useTool`, `useMemory`, `useTask` — for agent UIs running in iframes.

## UI (the actual product)

- [ ] **Home grid** — Show agent widgets on the home screen. Fetch widget data, render via widget DSL renderer.
- [ ] **Feed view** — Show feed events from agents. Currently a shell component with no live data.
- [ ] **Agent detail view** — Show agent info, run history, logs, functions, trigger status.
- [ ] **Run an agent function from UI** — Button to manually trigger a function, see result and logs.
- [ ] **Zeus chat** — Connect the chat panel to the Zeus SSE endpoint. Show streaming responses.
- [ ] **Settings page** — Set API keys, configure agents, manage secrets.
- [ ] **Agent install/uninstall UI** — Browse registry, install with one click, grant permissions.
- [ ] **Notifications** — When an agent posts to feed, show a notification.
- [ ] **Mobile responsive** — The OS should work on phone screens too.

## Infrastructure

- [ ] **Auth for runtime API** — JWT or API key middleware. Block unauthenticated access to all endpoints.
- [ ] **Rate limiting** — Prevent agents from burning API credits or compute. Per-agent quotas.
- [ ] **Encryption for secrets** — `agent_secrets.value` is plaintext. Encrypt at rest.
- [ ] **Fly runtime: health check endpoint** — `GET /health` for Fly's health monitoring.
- [ ] **Daytona compute provider** — Third provider subclass alongside Docker and Fly.
- [ ] **Agent image caching** — Don't rebuild Docker images on every run. Cache by manifest hash.
- [ ] **Proper logging infrastructure** — Structured JSON logs, log aggregation (Axiom, Grafana, etc.).
- [ ] **Database connection pooling** — Current pg Pool config is default. Tune for production.

## Future (after v0 works)

- [ ] **Remix/fork agents** — `magically remix <agent>` forks into workspace for modification.
- [ ] **Agent versioning + migrations** — Schema changes between versions, automatic data migration.
- [ ] **Agent signing/verification** — Cryptographic hash for tamper detection on published agents.
- [ ] **Monetization infrastructure** — Agent pricing, subscriptions, revenue share, billing.
- [ ] **Chrome extension input trigger** — Share content from browser to an agent.
- [ ] **Email input trigger** — Forward email to an agent's address.
- [ ] **Feed RSS/podcast output** — Audio feed items available as podcast feed.
- [ ] **Native macOS shell** — Swift app with WKWebView, system tray, hotkeys.
- [ ] **iOS app** — WKWebView + push notifications + share extension + home screen widgets.
- [ ] **Cross-platform** — Windows/Linux via Tauri, Android via Kotlin WebView.
