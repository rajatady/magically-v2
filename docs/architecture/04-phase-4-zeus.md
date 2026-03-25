# Phase 4 — Zeus Intelligence (Week 3-4)

Goal: Make the Zeus genuinely intelligent — persistent memory, multi-agent orchestration, agent building, and proactive behavior.

## 4.1 Zeus Architecture

The Zeus is NOT a wrapper around an LLM. It's a reasoning engine with:

```
┌─────────────────────────────────────────┐
│               SIDEKICK                   │
│                                          │
│  ┌──────────┐  ┌───────────────────┐    │
│  │ Memory   │  │ Agent Registry    │    │
│  │ (long-   │  │ (knows all agents │    │
│  │  term)   │  │  and their caps)  │    │
│  └────┬─────┘  └────────┬──────────┘    │
│       │                  │               │
│  ┌────▼──────────────────▼──────────┐   │
│  │        Reasoning Engine          │   │
│  │  (LLM with structured prompting) │   │
│  └────┬─────────────┬───────────────┘   │
│       │             │                    │
│  ┌────▼─────┐  ┌────▼──────────┐        │
│  │ Tool     │  │ Task          │        │
│  │ Executor │  │ Orchestrator  │        │
│  └──────────┘  └───────────────┘        │
└─────────────────────────────────────────┘
```

## 4.2 Memory System

Zeus builds persistent memory about the user:

```typescript
interface MemoryEntry {
  id: string;
  key: string;           // e.g., "user.kindle_email", "preference.diet", "fact.kids_names"
  value: string;
  category: 'user' | 'preference' | 'fact' | 'context' | 'relationship';
  confidence: number;    // 0-1, decays over time, refreshed on reconfirmation
  source: string;        // which conversation or event created this
  createdAt: Date;
  updatedAt: Date;
}
```

Memory is populated from:
- Explicit statements ("My Kindle email is rajat@kindle.com")
- Inferred from behavior (user always checks train schedule → commutes by train)
- Extracted from tool data (calendar shows kids' school events → user has kids)

Memory retrieval:
- On every Zeus conversation, relevant memories are injected into context
- Retrieval uses embedding similarity + category matching
- Memory is never shared with agents unless explicitly permissioned

## 4.3 Agent Builder (Zeus as Software Engineer)

When user says "build me an agent", the Zeus becomes a coding agent:

```
Step 1: UNDERSTAND
  - Parse user's natural language description
  - Identify: what tools are needed, what data sources, what UI
  - Ask clarifying questions if ambiguous

Step 2: BLUEPRINT
  - Generate structured plan:
    {
      name, description, tools, triggers, ui_description,
      data_model, permissions_needed
    }
  - Present to user for approval/editing

Step 3: BUILD
  - Generate manifest.json from blueprint
  - Generate prompt.md (agent's AI instructions)
  - Generate widget.json (Home screen widget)
  - Generate ui/App.tsx (full React UI)
  - Use tool registry to determine correct tool integrations

Step 4: TEST
  - Validate manifest schema
  - Render UI in preview iframe
  - Dry-run tool calls to verify wiring
  - Report any issues to user

Step 5: DEPLOY
  - Zeus runs `magically build` and `magically publish` to install
  - Add widget to Home grid
  - Add icon to sidebar
  - Push feed event: "New agent installed: {name}"

Step 6: ITERATE
  - User can say "change the UI" or "add a feature"
  - Zeus reads existing agent code
  - Zeus runs `magically validate` and reloads
  - Hot-reloads the agent
```

### Build System Prompt Strategy:

The Zeus uses a structured system prompt when building agents:

```
You are building an agent for the Magically platform.

AVAILABLE TOOLS:
{list of all registered tools with their schemas}

AGENT SDK HOOKS:
- useAgentData(table, query) — read/write agent's DB
- useTool(toolId) — call a platform tool
- useFeed() — push events to user's feed
- useWidget() — update the Home screen widget
- useMemory() — read user's Zeus memory (permissioned)

UI CONSTRAINTS:
- React 19 + Tailwind CSS 4
- Must be a single App.tsx file (can be large)
- Import agent SDK via: import { useAgentData, useTool, ... } from '@magically/agent-sdk'
- No external npm packages (everything is inline)
- Must be responsive (works in iframe at any size)

WIDGET SPEC:
{widget DSL documentation}

Generate:
1. manifest.json
2. prompt.md
3. widget.json
4. ui/App.tsx
```

## 4.4 Proactive Behavior

Zeus doesn't just respond — it initiates:

```typescript
// packages/runtime/src/zeus/proactive.ts

interface ProactiveCheck {
  id: string;
  schedule: string;           // cron expression
  check: (context: ZeusContext) => Promise<ProactiveAction | null>;
}

// Examples:
const checks: ProactiveCheck[] = [
  {
    id: 'morning-briefing',
    schedule: '0 7 * * *',     // 7am daily
    check: async (ctx) => {
      const events = await ctx.tool('calendar', 'list-events', { date: 'today' });
      const weather = await ctx.tool('weather', 'current');
      // Generate briefing, push to feed
    }
  },
  {
    id: 'schedule-conflicts',
    schedule: '*/15 * * * *',  // every 15 min
    check: async (ctx) => {
      const events = await ctx.tool('calendar', 'list-events', { date: 'today' });
      const conflicts = findConflicts(events);
      if (conflicts.length > 0) {
        return { type: 'alert', message: `Scheduling conflict: ${conflicts[0].summary}` };
      }
      return null;
    }
  },
  {
    id: 'agent-suggestions',
    schedule: '0 12 * * *',    // noon daily
    check: async (ctx) => {
      // Analyze user behavior patterns
      // Suggest new agents or tool connections
    }
  }
];
```

## 4.5 Zeus Conversation Modes

1. **Chat** — normal conversation, can call tools and agents inline
2. **Build** — agent creation mode, structured builder workflow
3. **Edit** — modifying an existing agent, code-aware
4. **Task** — executing a multi-step background task with progress reporting
5. **Remix** — forking a gallery agent and modifying it

The mode is inferred from context. User says "build me an agent" → switches to Build mode. User says "change the UI of SuperDo" → switches to Edit mode.

## 4.6 Deliverables

- [ ] Zeus memory system (store, retrieve, decay, refresh)
- [ ] Memory injection into LLM context (relevant memories per conversation)
- [ ] Agent Builder: full build pipeline (understand → blueprint → build → test → deploy)
- [ ] Agent editing: read existing code → make targeted changes → hot-reload
- [ ] Proactive checks: morning briefing, conflict detection, suggestions
- [ ] Conversation modes: chat, build, edit, task, remix
- [ ] Reasoning chain visibility (show user what Zeus is thinking)
- [ ] Multi-agent orchestration (Zeus calls multiple agents in sequence)
- [ ] Task system: propose → approve → execute → report (with progress updates)
- [ ] Error recovery: if agent build fails, Zeus diagnoses and fixes
