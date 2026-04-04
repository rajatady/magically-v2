# Zeus

Last synced: 2026-04-03

Zeus is the AI kernel of Magically. It wraps the Claude Agent SDK `query()` function with multi-tenant workspace management, persistent conversations, MCP tools for OS operations, and WebSocket streaming.

### 2026-04-03 Updates

- **Persistence**: Messages persisted at SDK batch boundaries (assistant events, tool results), not per-delta. Errors logged instead of swallowed.
- **ChatConfig**: `TOP_LEVEL_CHAT_CONFIG` (full tools, MCP, $1 budget, 30 turns) vs `AGENT_SCOPED_CHAT_CONFIG` (restricted tools, no MCP, $0.25, 10 turns). Passed via `ExecutionOptions.chatConfig`.
- **Delegate interfaces**: `ExecutorZeusDelegate` and `ExecutorAgentsDelegate` — no `unknown`/`any` types. Tools and executor depend on interfaces, not concrete classes.
- **File attachments**: `buildPromptWithFiles()` downloads from Tigris URLs, converts to base64, builds SDK content blocks (image/document/text). Applied before resume/fresh split so both paths include files.
- **Conversation management**: `updateConversationTitle()`, `listConversations()` with userId filter + pagination + search.
- **Disconnect behavior**: Queries keep running on disconnect (cc-harness pattern). Client reconnects and fetches persisted results.

---

## Module Structure

File: `packages/runtime/src/zeus/zeus.module.ts`

```
ZeusModule
  imports: [AgentsModule, EventsModule, AuthModule]
  providers: [ZeusService, ZeusGateway]
  controllers: [ZeusController]
  exports: [ZeusService]
```

---

## Agent SDK Integration

File: `packages/runtime/src/zeus/executor.ts`

### SDK Loading

The `@anthropic-ai/claude-agent-sdk` package is loaded lazily via dynamic `import()` to avoid CJS/ESM mismatch issues at compile time. A module-level `_sdk` variable caches the import.

### `query()` Configuration

```typescript
{
  cwd: workspaceDir,                          // per-user workspace path
  systemPrompt: {
    type: 'preset',
    preset: 'claude_code',
    append: zeusContext,                       // ZEUS_SYSTEM_CONTEXT + agents + memory + onboarding
  },
  tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
  allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
  permissionMode: 'bypassPermissions',
  allowDangerouslySkipPermissions: true,
  mcpServers: { magically: <MCP server instance> },
  includePartialMessages: true,
  enableFileCheckpointing: true,
  persistSession: true,
  maxTurns: 30,
  maxBudgetUsd: 1.00,
  model: 'claude-sonnet-4-6',
  settingSources: [],
  resume: <agentSessionId>,                   // only if resuming
  abortController: <AbortController>,         // only if provided
}
```

### Session Resume Strategy

1. If the conversation has stored `agentSessionId`(s), try `resume` with each (most recent first).
2. If resume succeeds, use that `queryResult` iterator.
3. If all resume attempts fail (or no session IDs exist), start a fresh `query()`.
4. For fresh queries without resume, conversation history is prepended to the prompt as context (see `buildPromptWithHistory`).

### History Prepend Format

When resume fails, prior messages are formatted and prepended:

```
Here is the conversation so far (for context -- you may not remember it):
---
[user]: <content truncated to 500 chars>
[assistant]: <content truncated to 500 chars>
---

Now, the user says:
<actual prompt>
```

---

## Executor Message Loop

File: `packages/runtime/src/zeus/executor.ts`

The `executePrompt()` function iterates over the async iterable returned by `sdk.query()`. Each message has a `type` field:

### Message Types

| `type` | Handling |
|---|---|
| `stream_event` | Contains SSE-style events from the model. Sub-dispatches on `event.type`. |
| `assistant` | Complete assistant message with content blocks. Used for tool_use blocks with full parsed input. |
| `user` | Tool results. Contains `tool_result` content blocks with `tool_use_id` and result content. |
| `system` | Status updates. Only `subtype: 'status'` is handled, forwarded via `onStatus`. |
| `result` | Execution summary. Contains `total_cost_usd`, `num_turns`, `duration_ms`, `modelUsage`. If `subtype !== 'success'`, errors are forwarded. |

### `stream_event` Sub-Events

| `event.type` | Action |
|---|---|
| `content_block_delta` (with `delta.type === 'text_delta'`) | Append text to `fullResponse`, update or create trailing text block, emit `onChunk`, persist via `updateMessage`. |
| `content_block_start` (with `content_block.type === 'tool_use'`) | Push new tool_use block (status: `running`), emit `onToolStart`. |

### `assistant` Message Processing

Only `tool_use` blocks are processed from assistant messages (text was already handled via `stream_event` deltas). Tool_use blocks are deduplicated by `id` -- if already created from `content_block_start`, the `input` field is updated with the full parsed input.

The `parent_tool_use_id` field is captured from the message and stored on the block as `parentToolUseId`, enabling nested tool call trees.

### `user` Message Processing (Tool Results)

When `msg.tool_use_result !== undefined`:

1. Iterate content blocks looking for `type === 'tool_result'`.
2. Extract result text (handles string, array of text blocks, or JSON fallback).
3. Find matching tool_use block by `tool_use_id`, set `result` (truncated to 2000 chars) and `status: 'done'`.
4. Emit `onToolResult`.
5. Persist via `updateMessage`.

### ContentBlock Type

```typescript
interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  tool?: string;
  input?: unknown;
  result?: string;
  status?: 'running' | 'done';
  parentToolUseId?: string | null;
}
```

### Execution Callbacks

```typescript
interface ExecutionCallbacks {
  onChunk?: (content: string) => void;        // accumulated full text
  onToolStart?: (toolUseId: string, tool: string, input: unknown) => void;
  onToolResult?: (toolUseId: string, result: string) => void;
  onStatus?: (status: string) => void;
  onResult?: (result: { cost: number; turns: number; durationMs: number; usage: unknown }) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}
```

### Agent Session ID Persistence

The first message that contains a `session_id` string triggers `zeus.updateConversationAgentSessionId()`. This stores the Agent SDK's internal session ID on the `zeusConversations` row for future resume.

### Error Handling

- If the async iterator throws, partial response and blocks are persisted with `updateMessage`.
- `onError` callback is fired.
- If the error message is `'aborted'` (from AbortController), no error event is emitted to the client.

---

## MCP Tools

File: `packages/runtime/src/zeus/tools.ts`

The MCP server is created via `createSdkMcpServer` from the Agent SDK. It exposes Magically OS operations to the model. The SDK and Zod are lazy-loaded to avoid CJS/ESM issues.

### Tool Inventory

| Tool | Parameters | Description |
|---|---|---|
| `ListAgents` | (none) | Lists all agents from `agents` table. Returns ID, name, version, description, and function names from manifest. |
| `GetAgent` | `id: string` | Returns full agent details including manifest as JSON. |
| `ReadMemory` | (none) | Returns all entries from `zeus_memory` table. Format: `[category] key: value (source: source)`. |
| `WriteMemory` | `key: string, value: string, category: string` | Upserts a memory entry. Categories: `"user"`, `"preference"`, `"context"`, `"fact"`. Source is hardcoded to `"zeus"`. |
| `DeleteMemory` | `key: string` | Deletes a memory entry by key. |
| `CreateTask` | `goal: string, priority?: string, requesterId?: string` | Creates a task. Priority: `"low"`, `"normal"` (default), `"high"`. `requesterId` defaults to the current `userId`. |
| `ListTasks` | (none) | Lists all tasks ordered by most recent first. Format: `[status] goal (priority: X, from: Y)`. |
| `ReadFeed` | `limit?: number` | Reads recent feed events from all agents. Returns type, title, body, data, timestamp. *(Added 2026-04-04)* |
| `ReadWidgets` | (none) | Reads all active widgets on the user's home screen. Returns agentId, size, html, updatedAt. *(Added 2026-04-04)* |

### Delegate Interface Extensions (2026-04-04)

`ReadFeed` and `ReadWidgets` are backed by new methods on the `ExecutorZeusDelegate` interface:

| Method | Signature | Description |
|--------|-----------|-------------|
| `getFeed` | `(limit?: number) => Promise<FeedEvent[]>` | Returns recent feed events |
| `getWidgets` | `(userId: string) => Promise<UserWidget[]>` | Returns user's active widgets |

Implemented in `ZeusService` via `FeedService` and `WidgetService`.

### MCP Server Configuration

```typescript
{
  name: 'magically',
  version: '1.0.0',
  tools: [ /* 9 tools above */ ]
}
```

Registered on the `query()` call as `mcpServers: { magically: <server> }`. Tools appear to the model as `mcp__magically__<ToolName>`.

---

## ZeusService

File: `packages/runtime/src/zeus/zeus.service.ts`

### Dependencies

| Dependency | Source |
|---|---|
| `DrizzleDB` | `@InjectDB()` -- database connection |
| `AgentsService` | Agent CRUD operations |
| `EventsGateway` | WebSocket event broadcasting |
| `EventEmitter2` | Internal event bus |

### Constants

```
DATA_DIR = process.env.DATA_DIR
         ?? (production ? '/data' : join(homedir(), '.magically'))
```

---

## System Prompt Construction

`buildZeusContext(workspaceDir?)` builds the full system prompt appended to the `claude_code` preset:

```
1. ZEUS_SYSTEM_CONTEXT (static preamble)
2. Installed agents list (from agents.findAll())
3. User memory entries (from zeus_memory table)
4. [Conditional] Onboarding instructions (if workspace not onboarded)
```

### ZEUS_SYSTEM_CONTEXT

```
You are Zeus, the trusted AI companion inside Magically -- a personal Agent OS.

You are the kernel of the system. You have access to all agents, tools, and the user's memory.

Your responsibilities:
1. Help users accomplish tasks by routing to the right agents and tools
2. Build new agents when asked -- create their manifest, functions, and UI in the user's workspace
3. Maintain memory about the user to personalize experiences
4. Orchestrate complex multi-step tasks across agents

Key behaviors:
- Be warm, direct, and efficient. No filler.
- When building agents, create a brief "blueprint" first and confirm with the user.
- You know what agents are installed and their capabilities.
- Use the Magically MCP tools (ListAgents, WriteMemory, CreateTask, etc.) for OS operations.
- Use Read/Write/Edit/Bash for file operations in the user's workspace.

You are NOT a chatbot. You are an operating system kernel that happens to speak.
```

### Installed Agents Format

```
Installed agents:
- <id>: <name> -- <description>
- <id>: <name> -- <description>
```

Or `"None yet."` if no agents are installed.

### Memory Format

```
User memory:
- [<category>] <key>: <value>
```

Omitted entirely if no memory entries exist.

### Onboarding Prompt

Appended when `workspaceDir` is provided and `.magically/onboarded` file does not exist. Instructs Zeus to ask the user for agent identity fields (ID, name, description) and update `manifest.json` before doing anything else.

---

## Workspace Management

### `ensureWorkspace(userId)`

```
1. Compute path: {DATA_DIR}/workspaces/{userId}
2. If manifest.json does not exist at that path:
   a. Call scaffoldAgent(dir, { agentId: 'my-agent', agentName: 'My Agent', agentDescription: 'A new Magically agent' })
   b. Log "Scaffolded new agent workspace for user {userId}"
3. Call syncWorkspaceDraft(userId, dir, manifestPath)
4. Return directory path
```

### `syncWorkspaceDraft(userId, dir, manifestPath)`

Reads `manifest.json` from the workspace and upserts an agent row in the `agents` table with:

| Field | Value |
|---|---|
| `id` | `workspace-{userId}` |
| `name` | `manifest.name` or `'My Agent'` |
| `description` | `manifest.description` or `null` |
| `icon` | `manifest.icon` or `null` |
| `authorId` | `userId` |
| `latestVersion` | `manifest.version` or `'0.1.0'` |
| `status` | `'draft'` |

Uses `onConflictDoUpdate` on `agents.id` so subsequent calls update the existing row.

### `isOnboarded(workspaceDir)`

Returns `true` if `{workspaceDir}/.magically/onboarded` file exists.

---

## Conversation CRUD

### Database Tables

| Table | Purpose |
|---|---|
| `zeus_conversations` | Conversation metadata: id, title, mode, agentId, userId, agentSessionId, rewindToSdkUuid, timestamps |
| `zeus_messages` | Individual messages: id, conversationId (FK), role, content, blocks (JSON string), sdkUuid, timestamps |

### Methods

| Method | Signature | Description |
|---|---|---|
| `createConversation` | `(mode?: 'chat'\|'build'\|'edit'\|'task', agentId?: string)` | Creates a conversation. Mode defaults to `'chat'`. Returns `{ id, mode, messages: [] }`. |
| `getConversation` | `(id: string)` | Returns raw conversation row or `undefined`. |
| `getConversationWithMessages` | `(id: string)` | Returns conversation with `messages` array from `zeus_messages`. Returns `null` if not found. |
| `listConversations` | `(limit?: number)` | Lists conversations ordered by `updatedAt` desc. Default limit 50. Selects specific columns (no messages). |
| `deleteConversation` | `(id: string)` | Deletes conversation. Messages cascade-deleted via FK. |
| `updateConversationAgentSessionId` | `(conversationId, agentSessionId)` | Stores the Agent SDK session ID for resume. |
| `setRewindPoint` | `(conversationId, sdkUuid)` | Sets `rewindToSdkUuid` on the conversation. |
| `getRewindPoint` | `(conversationId)` | Returns `rewindToSdkUuid` or `null`. |
| `clearRewindPoint` | `(conversationId)` | Sets `rewindToSdkUuid` to `null`. |

---

## Message Persistence

### `saveMessage(conversationId, role, content, blocks?, sdkUuid?)`

1. Generates UUID for message ID.
2. Inserts into `zeus_messages`. `blocks` is `JSON.stringify`-ed if provided, otherwise `null`.
3. Touches `zeusConversations.updatedAt`.
4. Returns `{ id }`.

### `updateMessage(messageId, content, blocks?, sdkUuid?)`

Updates an existing message row. `blocks` is `JSON.stringify`-ed if provided. Used for incremental persistence during streaming -- the executor calls this on every text chunk and tool result.

### `getMessages(conversationId, limit?, offset?)`

Returns messages ordered by `createdAt` ascending. Default limit 200, offset 0.

### `deleteMessagesAfter(conversationId, messageId)`

Finds the message by ID, then deletes all messages in the same conversation with `createdAt` greater than the target message's timestamp.

### Incremental Update Pattern

During execution:

```
1. Pre-create empty assistant message (saveMessage with content='')
2. On each text chunk: updateMessage(msgId, fullResponse, orderedBlocks)
3. On each tool result: updateMessage(msgId, fullResponse, orderedBlocks)
4. On completion: final updateMessage with complete content and blocks
5. On error: updateMessage with partial content or '[Error during execution]'
```

The `updateMessage` calls during streaming use `.catch(() => {})` to fire-and-forget. Only the final persist awaits.

---

## Memory CRUD

### Table: `zeus_memory`

| Method | Description |
|---|---|
| `getMemory()` | Returns all rows from `zeus_memory`. No user scoping. |
| `setMemory(key, value, category, source)` | Upserts by `key`. If key exists, updates `value`, `category`, `source`, `updatedAt`. If not, inserts new row with generated UUID. |
| `deleteMemory(key)` | Deletes by `key`. |

### Memory Entry Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `key` | string | Unique identifier (e.g., `"user.name"`, `"pref.theme"`) |
| `value` | string | The stored value |
| `category` | string | One of: `"user"`, `"preference"`, `"context"`, `"fact"` |
| `source` | string | Who stored it (e.g., `"zeus"`) |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

## Task CRUD

### Table: `zeus_tasks`

| Method | Description |
|---|---|
| `createTask(params)` | Inserts a task. Status is `'awaiting_approval'` if `requiresApproval` is true, otherwise `'pending'`. Returns the task UUID. |
| `getTasks()` | Returns all tasks ordered by `createdAt` desc. No user scoping. |

### Task Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `requesterId` | string | User ID or agent ID that requested the task |
| `goal` | string | What needs to be done |
| `context` | unknown (JSONB) | Optional structured context |
| `deliverables` | string[] | Optional list of deliverables |
| `priority` | `'low' \| 'normal' \| 'high'` | Default: `'normal'` |
| `requiresApproval` | boolean | Default: `false` |
| `status` | string | `'pending'`, `'awaiting_approval'`, etc. |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

## Execution Flow (End to End)

```
WebSocket 'prompt' event
  |
  v
ZeusGateway.handlePrompt()
  |
  +-- Create conversation if no sessionId
  +-- Abort previous execution
  +-- saveMessage(sessionId, 'user', prompt)
  +-- saveMessage(sessionId, 'assistant', '')       // pre-create
  |
  v
ZeusService.runPrompt()
  |
  +-- getConversation() for agentSessionId
  +-- getMessages() for history
  |
  v
executor.executePrompt()
  |
  +-- ensureWorkspace(userId)                       // scaffold if needed
  +-- createMagicallyMcpServer()                    // 7 MCP tools
  +-- buildZeusContext()                            // system prompt
  +-- Try resume from agentSessionIds
  +-- If no resume: buildPromptWithHistory()
  +-- sdk.query({ prompt, options })
  |
  v
Message loop (async iterator)
  |
  +-- stream_event -> onChunk, onToolStart
  +-- assistant -> tool_use block dedup
  +-- user (tool_result) -> onToolResult
  +-- system -> onStatus
  +-- result -> onResult, onError
  |
  +-- Each event: updateMessage() for persistence
  |
  v
Done -> onDone callback
  |
  v
ZeusGateway emits 'done' to client
```

---

## Known Issues

| Issue | Description |
|---|---|
| Disconnect aborts execution | When the WebSocket disconnects, the `AbortController` is aborted, terminating the `query()` iterator mid-stream. There is no mechanism to resume or continue the execution. Partial results are persisted. |
| Blocks stored as JSON string | The `zeus_messages.blocks` column stores blocks as `JSON.stringify(blocks)`. The frontend must handle both string and parsed array formats when loading history (`typeof m.blocks === 'string' ? JSON.parse(m.blocks) : m.blocks`). |
| No user scoping on memory/tasks | `getMemory()` and `getTasks()` return all rows without filtering by user. In a multi-tenant deployment, users would see each other's memory and tasks. |
| History truncation | `buildPromptWithHistory` truncates each message content to 500 characters. Long assistant responses lose context on resume failure. |
| Fire-and-forget persistence | Incremental `updateMessage` calls during streaming use `.catch(() => {})`. If the database is slow or fails, chunks are silently lost. Only the final persist is awaited. |
| Tool result truncation | Tool results are truncated to 2000 characters in the executor before persisting and sending to the client. |
| maxBudgetUsd hardcoded | The `$1.00` budget cap per execution is hardcoded in the executor. Not configurable per user or per conversation. |
| maxTurns hardcoded | The 30-turn limit is hardcoded. Long multi-step tasks may hit this ceiling. |
| Model hardcoded | `claude-sonnet-4-6` is hardcoded in the executor. Not configurable. |
| No task update/delete | The MCP tools expose `CreateTask` and `ListTasks` but no `UpdateTask` or `DeleteTask`. Tasks cannot be completed, cancelled, or removed via the model. |
| Workspace is single-agent | Each user gets one workspace with one `manifest.json`. The workspace agent ID is always `workspace-{userId}`. There is no multi-agent workspace support. |
| Onboarding is file-based | The onboarding check (`isOnboarded`) looks for `.magically/onboarded` file in the workspace. If the file is deleted, Zeus re-prompts for onboarding. The file must be created by the model itself as instructed in the system prompt. |
| Conversation mode unused | `createConversation` accepts a `mode` parameter (`'chat' | 'build' | 'edit' | 'task'`) but nothing reads or acts on this field downstream. |
| permissionMode bypasses all | `permissionMode: 'bypassPermissions'` with `allowDangerouslySkipPermissions: true` means the model can run any Bash command, write any file, and make any network request without user approval. |
