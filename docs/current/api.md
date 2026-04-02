# API Reference

> **Last synced**: 2026-03-28 | **Commit**: `97ab426` (development branch)

Base URL: `http://localhost:4321` (dev), configured via `VITE_API_URL` on frontend. All endpoints prefixed with `/api/`. Protected endpoints require `Authorization: Bearer <jwt>` or `X-API-Key: mg_...` header.

## Authentication (`/api/auth`)

Controller: `packages/runtime/src/auth/auth.controller.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | Public | Create account |
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/auth/google` | Public | Start Google OAuth |
| GET | `/api/auth/google/callback` | Public | OAuth callback |
| GET | `/api/auth/me` | Required | Current user info |
| POST | `/api/auth/api-keys` | Required | Create API key |

### POST /api/auth/signup

**Body**: `{ email: string, password: string, name?: string }`

**Response** `200`: `{ user: { id, email, name, provider }, accessToken: string }`

### POST /api/auth/login

**Body**: `{ email: string, password: string }`

**Response** `200`: `{ user: { id, email, name, provider }, accessToken: string }`

**Response** `401`: `{ message: "Invalid credentials" }`

### GET /api/auth/google

**Query**: `cli_redirect?` — URL to redirect CLI after auth

**Response**: `302` redirect to Google consent screen

### GET /api/auth/google/callback

**Query**: `code` (from Google), `state?` (contains cli_redirect if set)

**Response**: `302` redirect to `http://localhost:5173/auth/callback?token=<jwt>` or CLI redirect URL

### GET /api/auth/me

**Response** `200`: `{ sub: string, email: string, name?: string }`

### POST /api/auth/api-keys

**Body**: `{ name: string }`

**Response** `201`: `{ rawKey: "mg_...", apiKey: { id, name, keyPrefix } }`

The `rawKey` is only returned once. Stored as SHA256 hash.

---

## Agents (`/api/agents`)

Controller: `packages/runtime/src/agents/agents.controller.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agents` | Required | List all live agents |
| GET | `/api/agents/me` | Required | List authenticated user's agents (all statuses) |
| GET | `/api/agents/:id` | Required | Get agent with manifest |
| GET | `/api/agents/:id/widget` | Required | Get agent widget config |
| GET | `/api/agents/:id/ui` | Required | Get agent UI (not implemented — returns 501) |
| POST | `/api/agents/:id/run/:functionName` | Required | Execute an agent function |
| PUT | `/api/agents/:id/enable` | Required | Enable agent |
| PUT | `/api/agents/:id/disable` | Required | Disable agent |

### GET /api/agents

Returns all agents where `status = 'live'`, with latest version manifest joined.

**Response** `200`:
```json
[
  {
    "id": "hello-world",
    "name": "Hello World",
    "version": "1.0.0",
    "description": "A greeting agent",
    "icon": "👋",
    "color": "#3b82f6",
    "category": "Productivity",
    "enabled": true,
    "functions": [{ "name": "greet", "description": "Say hello", "parameters": {} }]
  }
]
```

### GET /api/agents/me

Returns all agents where `author_id = authenticated userId`, regardless of status. Includes drafts, building, failed.

**Response** `200`: Same shape as `/api/agents` but adds `"status": "draft" | "live" | "building" | ...` and `"hasWidget": boolean`.

### POST /api/agents/:id/run/:functionName

**Body**: Arbitrary JSON — passed as trigger payload.

**Response** `200`:
```json
{
  "runId": "...",
  "agentId": "hello-world",
  "functionName": "greet",
  "status": "success",
  "result": { "message": "Hello!" },
  "logs": [{ "level": "info", "message": "Running greet...", "timestamp": 1711612800000 }],
  "durationMs": 1234,
  "startedAt": 1711612800000
}
```

---

## Registry (`/api/registry`)

Controller: `packages/runtime/src/registry/registry.controller.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/registry/publish` | Required | Publish agent (multipart upload) |
| GET | `/api/registry/agents` | Required | Browse registry |
| GET | `/api/registry/agents/:id` | Required | Get registry agent detail |
| GET | `/api/registry/agents/:id/versions/:version` | Required | Get version detail |
| GET | `/api/registry/agents/:id/versions/:version/status` | Required | Get build status |
| POST | `/api/registry/agents/:id/install` | Required | Install agent |
| DELETE | `/api/registry/agents/:id/uninstall` | Required | Uninstall agent |
| GET | `/api/registry/installs` | Required | List user's installs |
| GET | `/api/registry/installs/:agentId` | Required | Get install detail |
| PUT | `/api/registry/installs/:agentId/config` | Required | Update install config |

### POST /api/registry/publish

**Content-Type**: `multipart/form-data`

**Fields**:
- `manifest` (required) — JSON string of agent manifest
- `bundle` (required) — tar.gz file of agent directory

**Response** `201`:
```json
{
  "agentId": "hello-world",
  "version": "1.0.0",
  "versionId": "...",
  "status": "processing"
}
```

### GET /api/registry/agents/:id/versions/:version/status

**Response** `200`: `{ "status": "building", "buildError": null, "imageRef": null }`

Status transitions: `processing → building → live | failed`

---

## Feed (`/api/feed`)

Controller: `packages/runtime/src/events/feed.controller.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/feed` | Required | List feed items |
| POST | `/api/feed` | Required | Create feed item |
| POST | `/api/feed/:id/read` | Required | Mark as read |
| POST | `/api/feed/:id/dismiss` | Required | Dismiss item |

### GET /api/feed

**Query**: `limit` (default 50)

**Response** `200`:
```json
[
  {
    "id": "...",
    "agentId": "hello-world",
    "type": "info",
    "title": "Agent published successfully",
    "body": "hello-world@1.0.0 is now live",
    "read": false,
    "createdAt": "2026-03-28T10:00:00Z"
  }
]
```

---

## Zeus (`/api/zeus`)

Controller: `packages/runtime/src/zeus/zeus.controller.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/zeus/chat` | Required | SSE streaming chat (fallback for WebSocket) |
| POST | `/api/zeus/conversations` | Required | Create conversation (stores userId) |
| GET | `/api/zeus/conversations` | Required | List conversations (filtered by userId, supports `?limit=&offset=&search=`) |
| GET | `/api/zeus/conversations/:id` | Required | Get conversation with messages |
| PATCH | `/api/zeus/conversations/:id` | Required | Update conversation (title) |
| DELETE | `/api/zeus/conversations/:id` | Required | Delete conversation |
| GET | `/api/zeus/memory` | Required | List memory entries |
| POST | `/api/zeus/memory` | Required | Create/update memory |
| DELETE | `/api/zeus/memory/:key` | Required | Delete memory entry |
| GET | `/api/zeus/tasks` | Required | List tasks |

### POST /api/zeus/chat

**Body**: `{ prompt: string, sessionId?: string }`

**Response**: Server-Sent Events stream. Each event is `data: <json>\n\n`:
```
data: {"type":"chunk","text":"Hello, I'll help you..."}
data: {"type":"tool:start","id":"toolu_01","tool":"Read","input":{"file_path":"manifest.json"}}
data: {"type":"tool:result","id":"toolu_01","result":"{ ... }"}
data: {"type":"result","cost":0.05,"turns":3,"durationMs":12000}
data: {"type":"done"}
```

### GET /api/zeus/conversations/:id

Returns conversation metadata + all messages from `zeus_messages` table ordered by created_at.

**Response** `200`:
```json
{
  "id": "...",
  "title": null,
  "mode": "chat",
  "messages": [
    { "id": "msg-1", "role": "user", "content": "build me an agent", "blocks": null, "sdkUuid": null, "createdAt": "..." },
    { "id": "msg-2", "role": "assistant", "content": "I'll create...", "blocks": "[{\"type\":\"text\",...}]", "sdkUuid": "...", "createdAt": "..." }
  ]
}
```

Note: `blocks` is a JSON *string*, not a parsed object. Frontend must `JSON.parse()` it.

### PATCH /api/zeus/conversations/:id

**Body**: `{ title?: string | null }`

**Response** `200`: Updated conversation object.

### GET /api/zeus/conversations (with params)

**Query params**: `?limit=50&offset=0&search=debug`

All conversations are filtered by the authenticated user's ID. Search matches against title (case-insensitive).

---

## Uploads (`/api/uploads`)

Controller: `packages/runtime/src/uploads/uploads.controller.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/uploads` | Required | Upload file to Tigris (`magically-v2-uploads` bucket) |

### POST /api/uploads

Upload a file via raw body stream. Max 10MB.

**Headers**:
- `Content-Type`: MIME type of the file
- `X-File-Name`: Original filename
- `Authorization`: Bearer token

**Response** `200`:
```json
{
  "url": "https://magically-v2-uploads.fly.storage.tigris.dev/1234-filename.jpg",
  "pathname": "1234-filename.jpg",
  "contentType": "image/jpeg",
  "size": 102400
}
```

Files are uploaded with `public-read` ACL. URLs use virtual-hosted style (`{bucket}.fly.storage.tigris.dev`).

### POST /api/zeus/memory

**Body**: `{ key: string, value: string, category: string, source?: string }`

**Response** `200`: `{ ok: true }`

---

## Config (`/api/config`)

Controller: `packages/runtime/src/config/config.controller.ts`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/config` | Required | Get app config |
| PUT | `/api/config` | Required | Update config |

### GET /api/config

**Response** `200`:
```json
{
  "hasApiKey": true,
  "defaultModel": "claude-sonnet-4-6",
  "zeusName": "Zeus",
  "theme": "dark",
  "accentColor": "#f97316"
}
```

### PUT /api/config

**Body**: Partial config object. Supports `openrouterApiKey` (stored securely, returned masked).

---

## Frontend ApiClient Methods

Defined in `packages/shared/src/api-client.ts`. All methods prepend `/api` to paths.

```typescript
// Auth
auth.signup(email, password, name?)
auth.login(email, password)
auth.me()
auth.createApiKey(name)
auth.googleUrl()

// Agents
agents.list()
agents.mine()
agents.get(id)
agents.widget(id)
agents.enable(id)
agents.disable(id)
agents.run(id, functionName, payload)

// Feed
feed.list(limit?)
feed.markRead(id)
feed.dismiss(id)

// Zeus
zeus.createConversation(mode?)
zeus.getConversation(id)
zeus.listConversations()
zeus.deleteConversation(id)
zeus.memory()
zeus.tasks()
zeus.getWorkspace()        // ← DEAD CODE: endpoint removed, method still in client

// Config
config.get()
config.update(partial)
```
