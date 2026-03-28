# WebSockets

Last synced: 2026-03-28 | Commit: 97ab426 (development branch)

Magically uses two Socket.IO gateways: a general-purpose events gateway on the root namespace and a dedicated Zeus gateway on `/zeus`. The frontend maintains two independent socket connections to match.

---

## Gateways

| Gateway | Namespace | File | Authentication | Purpose |
|---|---|---|---|---|
| `EventsGateway` | `/` | `packages/runtime/src/events/events.gateway.ts` | None | Broadcast feed items, agent updates, build logs |
| `ZeusGateway` | `/zeus` | `packages/runtime/src/zeus/zeus.gateway.ts` | JWT via handshake `auth.token` or query `?token=` | Zeus chat streaming |

Both gateways use `cors: { origin: '*' }`.

---

## EventsGateway (root namespace `/`)

### Architecture

`EventsGateway` bridges the NestJS `EventEmitter2` internal event bus to WebSocket broadcasts. It listens for internal events and re-emits them to all connected clients. There is no authentication -- any client can connect and receive events.

### Internal Event Bus Listeners

| Internal Event (`@OnEvent`) | WebSocket Event Emitted | Handler |
|---|---|---|
| `feed.new` | `feed:new` | `onFeedNew(item)` |
| `agent.update` | `agent:update` | `onAgentUpdate({ agentId, data })` |

### MagicallyEvent Union Type

All events emitted through the gateway conform to the `MagicallyEvent` union type:

```typescript
type MagicallyEvent =
  | { type: 'agent:update'; agentId: string; data: unknown }
  | { type: 'feed:new'; item: unknown }
  | { type: 'zeus:typing'; conversationId: string }
  | { type: 'zeus:chunk'; conversationId: string; content: string }
  | { type: 'zeus:done'; conversationId: string; message: string }
  | { type: 'agent:build:log'; agentId: string; log: string; level: 'info' | 'error' | 'success' }
  | { type: 'task:update'; taskId: string; status: string; result?: unknown };
```

Note: The `zeus:typing`, `zeus:chunk`, `zeus:done`, `agent:build:log`, and `task:update` event types are defined in the union but have no corresponding `@OnEvent` listeners wired up in the gateway. They exist in the type only. Zeus streaming actually happens via the separate `/zeus` namespace gateway.

### Server -> Client Events

| Event | Payload | Trigger |
|---|---|---|
| `feed:new` | `{ type: 'feed:new', item: unknown }` | Internal `feed.new` event |
| `agent:update` | `{ type: 'agent:update', agentId: string, data: unknown }` | Internal `agent.update` event |

### Client -> Server Events

None. The root gateway does not subscribe to any client messages (`@SubscribeMessage`). It is broadcast-only.

### Connection Lifecycle

- `handleConnection(client)` -- logs client ID.
- `handleDisconnect(client)` -- logs client ID.
- No authentication, no room management.

---

## ZeusGateway (`/zeus` namespace)

### Authentication

On connection, the gateway extracts a JWT token from either:

1. `client.handshake.auth.token` (preferred, set via Socket.IO `auth` option)
2. `client.handshake.query.token` (fallback for clients that cannot set auth)

If no token is present or `verifyToken()` throws, the client receives an `error` event and is immediately disconnected.

On successful auth, the user ID (`payload.sub`) is stored on the socket object as `(client as any).userId`.

### Active Execution Tracking

A module-level `Map<string, AbortController>` named `activeExecutions` tracks one running execution per socket ID. This enables:

- Interrupting a running prompt when a new one arrives on the same socket.
- Aborting execution when the socket disconnects.

### Client -> Server Events

| Event | Payload | Description |
|---|---|---|
| `prompt` | `{ prompt: string; sessionId?: string }` | Send a user prompt. If `sessionId` is omitted, a new conversation is created and its ID returned via `session` event. |
| `interrupt` | (none) | Abort the currently running execution for this socket. |

### Server -> Client Events

| Event | Payload | When |
|---|---|---|
| `session` | `{ sessionId: string }` | Immediately after creating a new conversation (when `prompt` had no `sessionId`). |
| `chunk` | `{ text: string }` | Accumulated full-text response during streaming. The client diffs against previous chunks to extract the delta. |
| `tool:start` | `{ id: string; tool: string; input: Record<string, unknown> }` | A tool invocation begins. |
| `tool:result` | `{ id: string; result: string }` | A tool invocation completes. Result is truncated to 2000 chars. |
| `status` | `{ status: string }` | Status updates from the Agent SDK (e.g., "thinking"). |
| `result` | `{ cost: number; turns: number; durationMs: number; usage: unknown }` | Execution summary after the model finishes all turns. |
| `error` | `{ message: string }` | Any error during auth or execution. Aborted executions do NOT emit error. |
| `done` | `{ sessionId: string }` | Execution complete. Signals the client to finalize the streamed message. |
| `interrupted` | (none) | Sent after a successful `interrupt` request. |

### `handlePrompt` Flow

```
1. Extract userId from socket
2. Validate prompt is non-empty
3. If no sessionId provided:
   a. zeus.createConversation() -> new conversation
   b. Emit 'session' { sessionId } to client
4. Abort any previous execution on this socket (Map lookup)
5. Create new AbortController, store in activeExecutions
6. zeus.saveMessage(sessionId, 'user', prompt)         -- persist user msg
7. zeus.saveMessage(sessionId, 'assistant', '')         -- pre-create empty assistant msg
8. zeus.runPrompt(sessionId, prompt, userId, callbacks, abortController, assistantMsgId)
9. On completion or error: delete from activeExecutions
```

### `handleDisconnect` Flow

```
1. Look up activeExecutions by client.id
2. If found: abort the controller, delete from map
3. Log disconnection
```

---

## Frontend: Global Socket (`apps/web/src/lib/socket.ts`)

### Setup

A module-level singleton `socket` connects to `http://localhost:4321` (hardcoded) using `['websocket', 'polling']` transports. No authentication is used (matches the unauthenticated root gateway).

### Functions

| Function | Description |
|---|---|
| `connectSocket()` | Creates and connects the socket if not already connected. Registers event listeners. |
| `disconnectSocket()` | Disconnects and nullifies the socket. Called from `useAuthStore.logout()`. |

### Event Listeners

| Event | Action |
|---|---|
| `connect` | Log to console. |
| `disconnect` | Log to console. |
| `feed:new` | `useStore.getState().prependFeedItem(item)` |
| `zeus:typing` | Sets `zeusTyping = true` if the conversation ID matches the active one in the store. |
| `zeus:chunk` | Calls `appendToLastMessage(content)` if conversation ID matches. |
| `zeus:done` | Sets `zeusTyping = false` if conversation ID matches. |

Note: These `zeus:*` listeners on the global socket are legacy. Zeus streaming now goes through the dedicated `/zeus` namespace socket. The global socket still listens for them but the server-side EventsGateway has no `@OnEvent` bindings that emit these events, so they are effectively dead code.

---

## Frontend: Zeus Socket (`apps/web/src/hooks/use-zeus-socket.ts`)

### Hook Signature

```typescript
function useZeusSocket(options: {
  sessionId: string | null;
  onSessionCreated?: (sessionId: string) => void;
}): {
  connected: boolean;
  streaming: boolean;
  messages: ZeusMessage[];
  stream: StreamState | null;
  sendMessage: (text: string) => void;
  interrupt: () => void;
  setMessages: React.Dispatch<React.SetStateAction<ZeusMessage[]>>;
}
```

### Connection Setup

On mount (runs once), the hook:

1. Reads `useAuthStore.getState().token`.
2. If no token, does nothing (no socket created).
3. Creates `io('/zeus', { auth: { token }, transports: ['websocket', 'polling'] })`.
4. On unmount, disconnects the socket.

### StreamState

```typescript
interface StreamState {
  blocks: ZeusBlock[];
  status: string | null;
  result: { cost: number; turns: number; durationMs: number; usage: unknown } | null;
  error: string | null;
}
```

A `stateRef` (React ref) holds the mutable `StreamState` during streaming. On each event, the ref is mutated and then `notify()` copies it into React state to trigger re-renders.

### Event Handling

| Server Event | Client Action |
|---|---|
| `connect` | `setConnected(true)` |
| `disconnect` | `setConnected(false)` |
| `session` | Calls `onSessionCreated(sessionId)` callback. |
| `chunk` | `applyChunk(stateRef, text)` -- diffs accumulated text to extract delta, appends to trailing text block. |
| `tool:start` | `applyToolStart(stateRef, id, tool, input)` -- adds or deduplicates tool_use block. |
| `tool:result` | `applyToolResult(stateRef, id, result)` -- marks tool block as done. |
| `status` | Sets `stateRef.current.status`. |
| `result` | Sets `stateRef.current.result`, clears status. |
| `done` | Extracts plain text from blocks, pushes finalized `ZeusMessage` to `messages` array, clears `stream` and `streaming`. |
| `error` | Sets `stateRef.current.error`, sets `streaming = false`. |
| `interrupted` | Sets `streaming = false`, clears `stream`. |

### `sendMessage(text)` Flow

```
1. Add optimistic user message to messages array (local UUID, role: 'user')
2. Reset stateRef to empty StreamState
3. Clear stream state, set streaming = true
4. Emit 'prompt' { prompt: text, sessionId } to server
```

### `interrupt()` Flow

```
1. Emit 'interrupt' to server
```

### History Loading

When `sessionId` changes (e.g., navigating to `/zeus/:chatId`), the hook fetches the full conversation via `zeus.getConversation(sessionId)` (HTTP GET) and populates `messages` from the response. Blocks may arrive as a JSON string (from the `zeus_messages` table) or already parsed, so it handles both cases.

---

## ZeusBlock / ZeusMessage Types

```typescript
interface ZeusBlock {
  type: 'text' | 'tool_use';
  text?: string;          // present when type === 'text'
  id?: string;            // present when type === 'tool_use'
  tool?: string;          // tool name, e.g., 'Read', 'Bash', 'mcp__magically__ListAgents'
  input?: Record<string, unknown>;
  result?: string;        // tool result text (truncated to 2000 chars server-side)
  status?: 'running' | 'done' | 'error';
  parentToolUseId?: string | null;  // for nested tool calls
  children?: ZeusBlock[];           // populated by buildBlockTree() for rendering
}

interface ZeusMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;         // plain text extracted from blocks
  blocks?: ZeusBlock[];    // ordered block array for rich rendering
  createdAt: string;       // ISO 8601
}
```

---

## Known Issues

| Issue | Description |
|---|---|
| Disconnect aborts execution | When a Zeus socket disconnects, the `AbortController` is called, which terminates any in-progress Agent SDK `query()`. If the user closes a tab or loses connectivity briefly, the entire execution is lost. There is no resume-on-reconnect. |
| Dual socket duplication | The frontend connects two separate sockets: the global socket (`/`) and the Zeus socket (`/zeus`). The global socket still has `zeus:typing`, `zeus:chunk`, `zeus:done` listeners, but no server-side code emits those events on the root namespace anymore. This is dead code. |
| Hardcoded global socket URL | `socket.ts` connects to `http://localhost:4321` with no environment variable. Only works in local dev. |
| No reconnection strategy on Zeus socket | The hook creates the socket once on mount. If the connection drops, Socket.IO's default reconnection applies, but no re-authentication or stream recovery occurs. |
| Chunk sends accumulated text | The `chunk` event sends the full accumulated response text each time, not just the delta. The client must diff to find the new content. This is bandwidth-inefficient for long responses. |
| Tool result truncation | Tool results are truncated to 2000 characters server-side before being sent to the client. Long results (e.g., file contents) are silently cut off in the UI. |
| No room-based routing | The root EventsGateway broadcasts to all connected clients. There is no per-user or per-conversation room scoping. Every connected client receives every `feed:new` and `agent:update` event. |
| Blocks stored as JSON string | The `zeus_messages.blocks` column stores blocks as a JSON string. The frontend must handle both string and parsed array formats when loading history. |
