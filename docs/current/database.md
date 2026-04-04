# Database Schema

> **Last synced**: 2026-04-04 | **Commit**: `93e7bdc` (development branch)

PostgreSQL. Local Postgres for dev, Neon for production. ORM: Drizzle. Schema defined in `packages/runtime/src/db/schema.ts`. Migrations in `packages/runtime/drizzle/`.

## Tables

### agents

All agents — published, draft, building, failed. Single source of truth. No separate registry table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Agent identifier (e.g., `hello-world` or `workspace-{userId}` for drafts) |
| name | text | NOT NULL | Display name |
| description | text | nullable | What the agent does |
| icon | text | nullable | Emoji or URL |
| color | text | nullable | Hex color for gradients |
| author_id | text | FK → users.id, nullable | User who created/owns this agent |
| category | text | nullable | E.g., "Productivity", "Finance" |
| tags | jsonb | default `[]` | String array of tags |
| latest_version | text | NOT NULL | Current version string (e.g., "1.0.0") |
| status | text | NOT NULL, default `'live'` | `'draft'` \| `'processing'` \| `'building'` \| `'live'` \| `'failed'` |
| source | text | NOT NULL, default `'remote'` | `'local'` \| `'remote'` — added migration 0006 |
| installs | integer | NOT NULL, default 0 | Install count |
| enabled | boolean | NOT NULL, default true | Whether agent is active |
| created_at | timestamp | NOT NULL | Creation time |
| updated_at | timestamp | NOT NULL | Last update time |

**`source` column** (migration 0006): Tracks where an agent originates. `'local'` agents are discovered from the `agents/` directory at runtime startup by `LocalDiscoveryService` and have no `agent_versions` rows. `'remote'` agents are published through the registry pipeline. If a previously `'remote'` agent is found on the local filesystem, `LocalDiscoveryService` updates its `source` to `'local'`.

### agent_versions

Per-version data. Each publish creates a new row. Contains the full manifest, build artifacts, and status.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Version record ID |
| agent_id | text | NOT NULL, FK → agents.id CASCADE | Parent agent |
| version | text | NOT NULL | Semver string |
| manifest | jsonb | NOT NULL | Full agent manifest JSON |
| bundle_url | text | nullable | Tigris S3 URL to tarball |
| image_ref | text | nullable | Primary Docker image ref (GHCR) |
| fly_image_ref | text | nullable | Fly registry copy |
| changelog | text | nullable | Version changelog |
| status | text | NOT NULL, default `'processing'` | `'processing'` \| `'building'` \| `'live'` \| `'failed'` |
| build_error | text | nullable | Error message when status = failed |
| published_at | timestamp | NOT NULL | When this version was published |

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | User ID (UUID) |
| email | text | NOT NULL, UNIQUE | Email address |
| password_hash | text | nullable | Null for OAuth-only users |
| name | text | nullable | Display name |
| avatar_url | text | nullable | Profile image URL |
| provider | text | NOT NULL, default `'local'` | `'google'` \| `'local'` |
| provider_id | text | nullable | Google sub ID |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

### api_keys

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Key record ID |
| user_id | text | NOT NULL, FK → users.id CASCADE | Owner |
| key_hash | text | NOT NULL | SHA256 hash of the raw key |
| key_prefix | text | NOT NULL | First 8 chars for display (e.g., `mg_abc123...`) |
| name | text | NOT NULL | User-given name for the key |
| last_used_at | timestamp | nullable | Last usage time |
| created_at | timestamp | NOT NULL | |

### feed_events

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Event ID |
| agent_id | text | FK → agents.id CASCADE, nullable | Source agent |
| type | text | NOT NULL | `'info'` \| `'success'` \| `'warning'` \| `'error'` \| `'audio'` |
| title | text | NOT NULL | Event title |
| body | text | nullable | Event body text |
| data | jsonb | nullable | Arbitrary structured data |
| audio_url | text | nullable | Audio file URL |
| read | boolean | NOT NULL, default false | Whether user has read it |
| created_at | timestamp | NOT NULL | |

### agent_runs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Run ID |
| agent_id | text | NOT NULL, FK → agents.id CASCADE | Agent that ran |
| function_name | text | NOT NULL | Which function was executed |
| trigger_type | text | NOT NULL | `'schedule'` \| `'event'` \| `'manual'` \| `'programmatic'` |
| trigger_source | text | nullable | Cron expression, event name, etc. |
| status | text | NOT NULL, default `'queued'` | `'queued'` \| `'running'` \| `'success'` \| `'error'` |
| compute_provider | text | nullable | `'in-process'` \| `'docker'` \| `'fly'` |
| exit_code | integer | nullable | Process exit code |
| result | jsonb | nullable | Function return value |
| error | text | nullable | Error message |
| logs | jsonb | nullable | Array of RunLog objects |
| duration_ms | integer | nullable | Execution time |
| started_at | timestamp | nullable | |
| completed_at | timestamp | nullable | |
| created_at | timestamp | NOT NULL | |

### agent_secrets

Composite PK on (agent_id, key). Stores per-agent secrets. **Currently plaintext — encryption at rest is TODO.**

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| agent_id | text | PK, FK → agents.id CASCADE | Agent |
| key | text | PK | Secret name |
| value | text | NOT NULL | Secret value (plaintext) |
| updated_at | timestamp | NOT NULL | |

### user_agent_installs

Tracks which users have installed which agents.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Install record ID |
| user_id | text | NOT NULL, FK → users.id CASCADE | User |
| agent_id | text | NOT NULL, FK → agents.id | Agent |
| version | text | NOT NULL | Installed version |
| config | jsonb | default `{}` | User's config overrides |
| enabled | boolean | NOT NULL, default true | |
| installed_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

### user_config

Global app config (key-value store).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| key | text | PK | Config key |
| value | jsonb | NOT NULL | Config value |
| updated_at | timestamp | NOT NULL | |

### zeus_conversations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Conversation ID (UUID) |
| title | text | nullable | Auto-generated or user-set title |
| messages | jsonb | nullable | **Legacy** — old JSONB blob, being replaced by zeus_messages table |
| mode | text | NOT NULL, default `'chat'` | `'chat'` \| `'build'` \| `'edit'` \| `'task'` |
| agent_id | text | nullable | Agent this conversation is building |
| agent_session_id | text | nullable | Claude Agent SDK session ID for resume |
| rewind_to_sdk_uuid | text | nullable | SDK message UUID for fork/rewind |
| user_id | text | nullable | Owner user ID |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

### zeus_messages

Individual messages in a Zeus conversation. Replaces the old JSONB blob. Supports incremental persistence during streaming.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Message ID (UUID) |
| conversation_id | text | NOT NULL, FK → zeus_conversations.id CASCADE | Parent conversation |
| role | text | NOT NULL | `'user'` \| `'assistant'` |
| content | text | NOT NULL, default `''` | Plain text content |
| blocks | text | nullable | JSON string of ContentBlock[] (tool_use + text blocks) |
| files | text | nullable | JSON string of FileAttachment[] (uploaded file URLs, not base64) |
| sdk_uuid | text | nullable | SDK message UUID for rewind/fork support |
| created_at | timestamptz | NOT NULL, default now() | |

**Index**: `idx_zeus_messages_conversation` on (conversation_id, created_at)

### zeus_memory

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | |
| key | text | NOT NULL, UNIQUE | Memory key |
| value | text | NOT NULL | Memory value |
| category | text | NOT NULL | Category tag |
| confidence | real | NOT NULL, default 1.0 | Confidence score |
| source | text | NOT NULL | Who wrote it (`'user'`, `'zeus'`, etc.) |
| expires_at | timestamp | nullable | Auto-expiry |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

### zeus_tasks

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | |
| requester_id | text | NOT NULL | Who requested the task |
| goal | text | NOT NULL | Task description |
| context | jsonb | nullable | Additional context |
| deliverables | jsonb | nullable | Expected outputs |
| priority | text | NOT NULL, default `'normal'` | `'low'` \| `'normal'` \| `'high'` |
| requires_approval | boolean | NOT NULL, default false | Needs user approval before running |
| status | text | NOT NULL, default `'pending'` | `'pending'` \| `'awaiting_approval'` \| `'running'` \| `'done'` \| `'failed'` |
| result | jsonb | nullable | Task result |
| callback_endpoint | text | nullable | Webhook on completion |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

### user_schedules

*Added 2026-04-04 (migration 0005)*

Per-user cron schedules. Users control when agent functions run automatically. The `TriggerSchedulerService` reads from this table (user-controlled), not from agent manifests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Schedule record ID (UUID) |
| user_id | text | NOT NULL, FK → users.id CASCADE | Owner |
| agent_id | text | NOT NULL | Target agent |
| function_name | text | NOT NULL | Function to execute |
| cron | text | NOT NULL | Cron expression (e.g., `"0 */6 * * *"`) |
| enabled | boolean | NOT NULL, default true | Whether the schedule is active |
| last_run_at | timestamp | nullable | Last execution time |
| created_at | timestamp | NOT NULL | |
| updated_at | timestamp | NOT NULL | |

Service: `packages/runtime/src/agents/schedule.service.ts` — `create(dto)`, `findByUser(userId)`, `findAllEnabled()`, `toggle(id, enabled)`, `updateCron(id, cron)`, `updateLastRun(id)`, `remove(id)`

Controller: `packages/runtime/src/agents/schedule.controller.ts` — `GET /api/schedules`, `POST /api/schedules`, `PUT /api/schedules/:id/toggle`, `PUT /api/schedules/:id/cron`, `DELETE /api/schedules/:id`

Scheduler: `packages/runtime/src/agents/trigger-scheduler.service.ts` — reads `findAllEnabled()` on module init and after every CRUD operation (`refresh()`). Registers `CronJob` instances via NestJS `SchedulerRegistry`.

### user_widgets

*Added 2026-04-04 (migration 0004)*

Agent-emitted HTML widgets displayed on the user's home screen. Upserted by userId + agentId.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | text | PK | Widget record ID |
| user_id | text | NOT NULL, FK → users.id CASCADE | Owner |
| agent_id | text | NOT NULL, FK → agents.id CASCADE | Source agent |
| size | text | NOT NULL | `'small'` \| `'medium'` \| `'large'` |
| html | text | NOT NULL | Raw HTML content (inline CSS, inline SVG) |
| position | integer | NOT NULL, default 0 | Display order on home screen |
| updated_at | timestamp | NOT NULL | Last upsert time |

Service: `packages/runtime/src/events/widget.service.ts` — `upsert(userId, agentId, size, html)`, `findByUser(userId)`, `remove(userId, agentId)`

Controller: `packages/runtime/src/events/widget.controller.ts` — `GET /api/widgets`, `POST /api/widgets`, `DELETE /api/widgets/:agentId`

## Migrations

| Migration | File | Changes |
|-----------|------|---------|
| 0000 | `0000_square_machine_man.sql` | Initial schema: all tables except zeus_messages |
| 0001 | `0001_yummy_mole_man.sql` | Add title, agent_session_id, user_id to zeus_conversations |
| 0002 | `0002_gorgeous_amazoness.sql` | Create zeus_messages table, make conversations.messages nullable, add rewind_to_sdk_uuid |
| 0003 | `0003_rich_ben_urich.sql` | Add `files` column to zeus_messages |
| 0004 | *(migration 0004)* | Create `user_widgets` table (id, userId, agentId, size, html, position, updatedAt) |
| 0005 | *(migration 0005)* | Create `user_schedules` table (userId, agentId, functionName, cron, enabled, lastRunAt) |
| 0006 | *(migration 0006)* | Add `source` column to `agents` table (`'local'` \| `'remote'`, default `'remote'`) |

## Test Database

Separate database: `magically_v2_test`. Auto-created and migrated via Jest `globalSetup`. Reads `DATABASE_URL` env var, falls back to `postgres://localhost:5432/magically_v2_test`.

## Drizzle Configuration

```
packages/runtime/drizzle.config.ts
  schema: ./src/db/schema.ts
  out: ./drizzle
  dialect: postgresql
  dbCredentials.url: process.env.DATABASE_URL
```

Commands: `bun run db:generate` (new migration), `bun run db:migrate` (apply), `bun run db:push` (destructive reset).
