# Phase 3 — Agent System Deep Dive (Week 2-3)

Goal: Build the full agent lifecycle — creation, execution, triggers, data, and inter-agent communication.

## 3.1 Agent Lifecycle

```
CREATE → INSTALL → CONFIGURE → RUN → UPDATE → SHARE
```

### Creation (via Sidekick Builder):
1. User describes what they want in natural language
2. Sidekick generates a "blueprint" (structured plan) — user can review/edit
3. User approves → Sidekick generates:
   - `manifest.json` (agent metadata, tools, triggers, permissions)
   - `prompt.md` (system instructions for the agent's AI brain)
   - `widget.json` (Home screen widget spec)
   - `ui/App.tsx` (full agent UI as React artifact)
4. Runtime validates the generated files
5. Agent is installed into `~/.magically/agents/{id}/`
6. Widget appears on Home, agent appears in sidebar

### Execution:
Agents can run in three modes:

**Interactive** — User opens the agent, interacts with its UI
```
User action (button click, form submit)
  → iframe postMessage to parent
  → parent forwards to runtime API
  → runtime executes agent logic (LLM call, tool call, DB query)
  → runtime responds
  → parent postMessage to iframe
  → UI updates
```

**Background (trigger-based)** — Agent runs on schedule or event
```
Trigger fires (cron, webhook, file shared, email received)
  → runtime loads agent
  → runtime executes agent's prompt with trigger context
  → agent calls tools, processes data
  → agent stores results in its DB tables
  → agent pushes feed event + widget update
  → user sees update on Home / in Feed
```

**Sidekick Task** — Heavy agentic work, triggered by user OR by agents
```
Two entry points:

A) User → Sidekick → Task (user asks something complex in chat)
  Sidekick determines task needs deep work
    → Sidekick proposes a "Sidekick Task" to user
    → User approves
    → Runtime spawns task execution
    → Task completes, results stored
    → Feed event + notification pushed

B) Agent → Sidekick Task (agent delegates heavy work)
  This is critical. Agents are lightweight — they handle UI and simple logic.
  For anything requiring deep reasoning, multi-tool orchestration, or cross-agent
  data access, agents kick off a Sidekick Task.

  Example: Calendar Hero
    → Calendar Hero trigger fires (new meeting in 23 minutes)
    → Calendar Hero calls: sdk.createSidekickTask({
        goal: "Prepare briefing for meeting with Ali Rougani",
        context: { meetingId, attendees, calendarEvent },
        deliverables: ["briefing_summary", "last_interaction", "linkedin_profile"]
      })
    → Sidekick Task executes:
        1. Searches email for past threads with Ali
        2. Searches calendar for previous meetings
        3. Reads Sidekick memory for known context about Ali
        4. Searches web for Ali's LinkedIn profile
        5. Synthesizes into a briefing
    → Results stored in Calendar Hero's data tables
    → Calendar Hero's widget updates with "Briefing ready"
    → Calendar Hero's UI shows the full briefing when opened

  Example: SuperDo
    → User adds todo: "Take Mateo to see monster trucks"
    → SuperDo agent calls: sdk.createSidekickTask({
        goal: "Research monster truck events for a 19-month-old near San Francisco",
        context: { todoItem, childAge: "19 months", location: "SF Bay Area" },
        deliverables: ["events", "tickets", "tips"]
      })
    → Sidekick Task executes:
        1. Reads memory: Mateo is 19 months old, lives in SF Bay Area
        2. Searches web for monster truck events near SF
        3. Finds Monster Jam at Oakland Arena, Apr 3-5
        4. Checks calendar for conflicts
        5. Compiles: event info, ticket links, age-appropriate tips (ear protection!)
    → Results stored in SuperDo's data tables
    → SuperDo's todo item now shows "Insights ready" badge

  This is what makes agents on this platform fundamentally different from
  traditional apps. Any agent can leverage the full power of the Sidekick
  (all tools, all memory, all cross-agent data) without implementing that
  complexity itself.
```

```typescript
// In the Agent SDK:
interface SidekickTaskRequest {
  goal: string;                          // Natural language goal
  context: Record<string, any>;          // Structured context from the agent
  deliverables: string[];                // What the agent expects back
  priority?: 'low' | 'normal' | 'high'; // Affects execution order
  requiresApproval?: boolean;            // If true, user must approve before execution
  callbackEndpoint?: string;             // Agent endpoint to POST results to
}

// Usage in agent code:
const { createTask, taskStatus } = useSidekickTask();

const task = await createTask({
  goal: "Prepare briefing for meeting with Ali Rougani",
  context: { meetingId: "abc123", attendees: ["ali@example.com"] },
  deliverables: ["briefing_summary", "talking_points", "last_interaction"],
  priority: 'high'
});

// Task runs in background. Agent can poll or listen for completion:
const result = await task.waitForCompletion(); // or use WebSocket event
// result.data.briefing_summary, result.data.talking_points, etc.
```

## 3.2 Agent Sandbox (iframe)

Each agent UI runs in a sandboxed iframe for security:

```html
<iframe
  src="blob:..."
  sandbox="allow-scripts allow-forms"
  referrerpolicy="no-referrer"
  csp="default-src 'self'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'"
></iframe>
```

The iframe CANNOT:
- Access the parent DOM
- Make direct network requests (all go through the bridge)
- Read other agents' data
- Access the filesystem

The iframe CAN:
- Run React + JS
- Call the agent SDK (which uses postMessage)
- Request data from its own agent's DB
- Request tool calls (via the bridge → runtime)
- Render arbitrary UI

### Agent SDK (provided to every agent):

```typescript
// packages/agent-sdk/src/hooks.ts

// Get data from the agent's database
const { data, loading } = useAgentData('events', {
  where: { date: 'today' },
  orderBy: 'time'
});

// Call a tool
const { execute, result } = useTool('google-calendar');
await execute({ action: 'list-events', params: { date: 'today' } });

// Push to feed
const { push } = useFeed();
push({ message: 'Prepared briefing for your 2pm meeting', type: 'info' });

// Update widget data
const { update } = useWidget();
update({ events: freshEvents, badge: { text: 'LIVE', color: 'blue' } });

// Access user memory (read-only, permissioned)
const { get } = useMemory();
const timezone = await get('user.timezone');

// Navigate / open things
const { openUrl, openAgent } = useNavigation();
```

## 3.3 Agent Data Model

Each agent gets its own SQLite tables, namespaced:

```sql
-- System tables (shared)
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manifest JSON NOT NULL,
  installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  enabled BOOLEAN DEFAULT 1
);

CREATE TABLE feed_events (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,  -- info, action, alert, success
  data JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read BOOLEAN DEFAULT 0,
  acted BOOLEAN DEFAULT 0,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE sidekick_memory (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  category TEXT,  -- user, preference, fact, context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sidekick_conversations (
  id TEXT PRIMARY KEY,
  messages JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Per-agent tables are created dynamically
-- e.g., agent_calendar_hero_events, agent_calendar_hero_briefings
-- Agents define their schema in manifest.json or via SDK calls
```

## 3.4 Tool System

Tools are the capabilities agents can use. Each tool is a module:

```typescript
// packages/runtime/src/tools/types.ts
interface Tool {
  id: string;
  name: string;
  description: string;        // Used by LLM to understand what the tool does
  category: 'data' | 'action' | 'generation' | 'integration';

  // Parameters the tool accepts (JSON Schema)
  parameters: JSONSchema;

  // Execute the tool
  execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult>;

  // OAuth config if needed
  auth?: {
    type: 'oauth2' | 'api-key' | 'none';
    provider?: string;
    scopes?: string[];
  };
}

interface ToolContext {
  agentId: string;
  userId: string;
  memory: MemoryAccess;
  db: DatabaseAccess;
}
```

Built-in tools for Phase 3:
- **google-calendar** — list events, create events, check conflicts
- **web-search** — search the web (via SerpAPI or Brave Search)
- **weather** — current weather + forecast
- **email** — read/send email (Gmail OAuth)
- **slack** — send messages, read channels
- **text-to-speech** — generate audio (via ElevenLabs or similar)
- **image-generation** — generate images (via DALL-E, Flux)

## 3.5 Inter-Agent Communication

Agents don't talk to each other directly. The Sidekick mediates:

```
Agent A needs data from Agent B
  → Agent A requests via SDK: useAgentData('calendar-hero', 'events')
  → SDK sends postMessage to parent
  → Parent forwards to runtime
  → Runtime checks permissions (does Agent A have access to Agent B's data?)
  → If yes: runtime queries Agent B's data, returns to Agent A
  → If no: runtime rejects, Agent A shows "permission needed" UI
```

The Sidekick has universal access and can orchestrate multi-agent tasks:

```
User: "Send tonight's dinner menu to David via Slack"
  → Sidekick identifies: need meal-service agent + Slack tool
  → Sidekick calls meal-service agent's data endpoint
  → Gets tonight's menu
  → Sidekick calls Slack tool to send DM to David
  → Sidekick reports back to user + pushes feed event
```

## 3.6 Deliverables

- [ ] Full agent manifest spec + validation
- [ ] Agent installation from filesystem + from URL
- [ ] Sandboxed iframe renderer with CSP
- [ ] Agent SDK: postMessage bridge, React hooks (useAgentData, useTool, useFeed, useWidget)
- [ ] Background trigger system (cron scheduler, event listeners)
- [ ] Sidekick Task execution (multi-step, multi-tool chains)
- [ ] Agent data model (per-agent SQLite tables)
- [ ] Tool system: registry, execution, auth management
- [ ] 5+ built-in tools (calendar, search, weather, email, slack)
- [ ] Inter-agent data access with permission model
- [ ] Agent hot-reload (edit code → see changes instantly)
- [ ] 3 complete demo agents with full UI
