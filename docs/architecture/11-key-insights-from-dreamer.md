# Key Architectural Insights from Dreamer's Blog Post

Source: David Singleton's blog (Dreamer CEO, ex-Stripe CTO)
Status: These insights need to be incorporated into our phase docs.

## 1. Agent Functions — The Composability Primitive

Every agent exposes **Functions** — typed, callable endpoints that make the agent's capabilities available to the entire system.

```
Recipe Book agent exposes:
  - findRecipe(query: string) → Recipe
  - listRecipes(category?: string) → Recipe[]
  - getIngredients(recipeId: string) → Ingredient[]

Grocery List agent exposes:
  - addItem(item: string, quantity?: number) → void
  - getList() → GroceryItem[]
  - clearList() → void
```

This means:
- Sidekick can call any agent's functions (this is how it orchestrates)
- Agents can request Sidekick to call another agent's functions on their behalf
- Every agent is automatically a "tool" that Sidekick can use
- When user says "put my chili recipe ingredients on my grocery list", Sidekick:
  1. Calls `RecipeBook.findRecipe("beef brisket chili")`
  2. Calls `RecipeBook.getIngredients(recipeId)`
  3. For each ingredient: calls `GroceryList.addItem(ingredient)`

**This is the Unix pipes of the agent era.** Single-purpose agents composing via functions.

### Impact on our architecture:

```jsonc
// In manifest.json, agents declare their functions:
{
  "functions": [
    {
      "name": "findRecipe",
      "description": "Search recipes by name or ingredient",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search term" }
        },
        "required": ["query"]
      },
      "returns": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "ingredients": { "type": "array" }
        }
      }
    }
  ]
}
```

In the Agent SDK:
```typescript
// Defining functions (inside the agent):
export const functions = {
  findRecipe: async ({ query }, ctx) => {
    const recipes = await ctx.db.query('SELECT * FROM recipes WHERE name LIKE ?', [`%${query}%`]);
    return recipes[0];
  },
  getIngredients: async ({ recipeId }, ctx) => {
    return ctx.db.query('SELECT * FROM ingredients WHERE recipe_id = ?', [recipeId]);
  }
};

// Calling another agent's functions (via Sidekick mediation):
const { callAgent } = useSidekick();
const recipe = await callAgent('recipe-book', 'findRecipe', { query: 'chili' });
```

## 2. Tools Are MCP Servers

Dreamer tools are literally MCP (Model Context Protocol) servers. This is not a custom protocol — it's the emerging industry standard.

```
Tool = MCP Server + Skills + Branding

MCP Server: standardized tool interface (list tools, call tool, get results)
Skills: agent-facing documentation on how to best use the tool
Branding: icon, description, screenshots for Gallery display
```

### Impact on our architecture:

We should be MCP-native from day one. Our tool registry should:
- Support any standard MCP server as a tool
- Auto-discover tools from MCP server manifests
- Let users connect their own MCP servers
- Ship built-in tools as MCP servers too

This means the entire MCP ecosystem is immediately compatible with Magically.

```typescript
// packages/runtime/src/tools/mcp-adapter.ts
import { Client } from '@modelcontextprotocol/sdk/client';

class MCPToolAdapter implements Tool {
  private client: Client;

  constructor(serverUrl: string) {
    this.client = new Client({ url: serverUrl });
  }

  async listTools() {
    return this.client.listTools();
  }

  async execute(toolName: string, params: any) {
    return this.client.callTool(toolName, params);
  }
}
```

## 3. Agent Anatomy — More Than Just UI

Dreamer agents consist of SIX components, not just UI + manifest:

```
Agent = Triggers + Deterministic Code + Prompts + Sub-agents + UI + Database + Static Files

1. Triggers
   - User interaction (UI events)
   - Email received from specific sender
   - File shared with agent (phone sharesheet, Chrome extension, drag-drop)
   - Scheduled (cron)
   - Webhook
   - Another agent's function call

2. Deterministic Code (Software 1.0)
   - Regular JS/TS code for fast decisions
   - "Should I run the expensive LLM prompt or not?"
   - Data transformation, validation, routing
   - This runs BEFORE any LLM call

3. Prompts (Software 3.0)
   - LLM calls for reasoning, generation, understanding
   - Agent has its own system prompt (prompt.md)
   - Can make multiple LLM calls per execution

4. Sub-agents (Sidekick Tasks)
   - Agent delegates complex work to Sidekick
   - Sidekick has access to all tools, memory, and other agents
   - Returns structured results back to the requesting agent

5. UI
   - React artifact for rich interactive experience
   - Works on desktop and mobile
   - Widget for Home grid (declarative DSL)
   - Feed posts for background activity

6. Database + Static Files
   - Auto-provisioned SQLite tables
   - Static assets (images, audio, documents)
```

### Impact on our architecture:

Our agent format needs to expand:

```
agents/recipe-book/
  manifest.json          # metadata, functions, triggers, permissions
  prompt.md              # LLM system prompt
  widget.json            # Home widget spec
  logic/
    triggers.ts          # Trigger handlers (deterministic code)
    functions.ts         # Exposed functions (callable by Sidekick/other agents)
    tasks.ts             # Sidekick Task definitions
  ui/
    App.tsx              # Full agent UI
  assets/                # Static files
```

## 4. The CLI — Built for Agent Consumption

Dreamer has a CLI (`dreamer`) that Sidekick uses as a coding agent. Key insight: the CLI is the primary interface for building, not direct file generation.

```bash
$ dreamer init my-agent          # scaffold
$ dreamer dev                    # hot-reload dev server
$ dreamer build                  # bundle
$ dreamer test                   # run agent tests
$ dreamer validate               # check manifest, functions, permissions
$ dreamer publish                # push to Gallery
$ dreamer install courtside      # install from Gallery
$ dreamer remix courtside        # fork
$ dreamer logs my-agent          # read agent logs
$ dreamer data my-agent          # inspect agent database
```

Why this matters:
- Comprehensive inline docs → LLMs can read `--help` and understand everything
- Build/validate/test loop → Sidekick can verify its own work
- Log reading → Sidekick can debug failures
- This makes the agent-building process **self-correcting**

### Impact on our architecture:

Add a `magically` CLI to Phase 1:

```
packages/
  cli/                    # The CLI tool
    src/
      commands/
        init.ts           # Scaffold new agent
        dev.ts            # Hot-reload development
        build.ts          # Bundle for distribution
        test.ts           # Run agent tests
        validate.ts       # Validate manifest + functions
        publish.ts        # Push to Gallery
        install.ts        # Install from Gallery
        remix.ts          # Fork an agent
        logs.ts           # Read agent logs
        data.ts           # Inspect agent DB
      index.ts
    package.json
```

Sidekick's build flow becomes:
1. `magically init my-agent` → scaffold
2. Edit files (manifest, prompts, logic, UI)
3. `magically validate` → check for errors
4. `magically dev` → start dev server
5. `magically test` → run tests
6. Fix issues, repeat 2-5
7. `magically build` → bundle
8. Deploy to user's agent directory

## 5. Feed + RSS Podcast — OS-Level Feature

The Feed is not just a notification list. It's an OS-level pub/sub system with audio-native support:

- Any agent can post to the Feed (text, rich cards, audio)
- Audio posts automatically appear in an RSS feed
- User scans QR code to add RSS feed to Apple Podcasts / Spotify / any podcast app
- This is how Calendar Hero's morning briefing ends up in your podcast app

### Impact on our architecture:

```typescript
// packages/runtime/src/feed/rss.ts
// The runtime serves an RSS feed at localhost:4321/feed/podcast/rss.xml

import { generateRSS } from './rss-generator';

// Any agent can post audio to the feed:
await feed.post({
  agentId: 'calendar-hero',
  type: 'audio',
  title: 'Monday Morning Briefing',
  audioUrl: '/agents/calendar-hero/assets/briefing-2026-03-24.mp3',
  description: '4 meetings today. Conflict at 5pm. Kids have early dismissal.',
});

// The RSS feed auto-includes all audio feed items
// GET /feed/podcast/rss.xml → valid podcast RSS
```

## 6. Email as Sidekick Input

Every user gets a unique email address (e.g., `rajat-abc123@magically.run`).

Forward any email to Sidekick with instructions:
- "Put this on my calendar"
- "Draft a response"
- "Add this to my todo list"
- "Send this to Recipe Book"

### Impact on our architecture:

Phase 1 (local): Skip email (requires server)
Phase 9 (cloud): Add email ingestion as a Sidekick input channel

```
Email received at user's Magically address
  → Cloud service parses email
  → Extracts: subject, body, attachments, forwarded content
  → Sends to Sidekick as a message with email context
  → Sidekick processes as if user had typed in chat
  → Results posted to Feed + notification
```

## 7. Chrome Extension — Web Page → Agent Pipeline

Send any webpage to any compatible agent:
- User visits a recipe blog → sends to Recipe Book
- User finds an article → sends to Read Later / Pocketable
- User sees a product → sends to Price Tracker

### Impact on our architecture:

Phase 6 addition: Chrome Extension

```
Extension popup:
  1. User clicks extension icon
  2. Extension shows list of agents that accept web pages
  3. User selects agent
  4. Extension sends: { url, title, selectedText?, screenshot? }
  5. Runtime routes to agent's trigger handler
  6. Agent processes the page
```

## 8. Memory — Agent-Writable, Sidekick-Mediated

Agents can WRITE to Sidekick memory, not just read:

```
Health Coach agent → user logs a meal
  → Health Coach tells Sidekick: memory.write("user.dietary.today_calories", 1840)
  → Now when Smart Groceries asks Sidekick about dietary preferences,
    it has up-to-date context

SuperDo agent → user completes "RSVP to Ben & Helena's wedding"
  → SuperDo tells Sidekick: memory.write("social.ben_helena_wedding_rsvp", "done")
  → Next time Sidekick encounters Ben & Helena context, it knows RSVP is done
```

But: memory writes go through Sidekick, which checks that the write aligns with the agent's declared purpose. A sports agent shouldn't be writing health data.

### Impact on our architecture:

```typescript
// Agent SDK — writing memory (mediated by Sidekick)
const { readMemory, writeMemory } = useSidekickMemory();

// Read (Sidekick filters to only relevant data for this agent's purpose)
const dietPrefs = await readMemory('user.dietary.preferences');

// Write (Sidekick validates the write is within agent's declared scope)
await writeMemory('user.dietary.today_calories', 1840, {
  reason: 'User logged lunch via Health Coach'
});
```

## 9. Rich Agent Editor

Not just "chat with Sidekick to build". There's a full IDE:

```
┌─────────────────────┬──────────────────────────────┐
│  Sidekick Chat      │  Agent Preview               │
│                     │  ┌──────┐ ┌──────┐ ┌──────┐  │
│  [conversation      │  │Desktop│ │Phone │ │Widget│  │
│   about building    │  └──────┘ └──────┘ └──────┘  │
│   and editing       │                                │
│   the agent]        │  [Live preview of agent UI     │
│                     │   across form factors]          │
│                     ├──────────────────────────────┤
│                     │  Tabs: Prompts | Logs | Data  │
│                     │        | Functions             │
│                     │                                │
│                     │  [Direct access to inspect     │
│                     │   and modify agent internals]  │
└─────────────────────┴──────────────────────────────┘
```

### Impact on our architecture:

The Build view in our React app needs to be expanded to a full Agent Editor with:
- Sidekick chat (left panel)
- Live preview with device switcher (desktop/phone/widget)
- Tabs: Prompts, Logs, Data, Functions
- Direct prompt editing
- Function testing (call functions manually)
- Log viewer (real-time build logs)

## 10. Sidekick is Adaptive

Critical behavioral detail: Sidekick adapts to what's available.

"Put my chili recipe ingredients on my grocery list"
- If Recipe Book exists → uses Recipe Book
- If no Recipe Book → searches the web for a chili recipe
- If Grocery List agent exists → uses it
- If no Grocery List → puts items in a Google Doc called "Grocery List"
- If user corrects Sidekick → it remembers for next time

This means Sidekick doesn't have a fixed plan. It dynamically routes based on:
1. What agents are installed
2. What tools are connected
3. What memory it has about user preferences
4. What it learned from previous corrections

## Summary of Required Changes to Our Docs

| Gap | Which Phase Doc | Priority |
|-----|----------------|----------|
| Agent Functions (composability) | Phase 3 | Critical |
| MCP-native tools | Phase 1, Phase 3 | Critical |
| Agent anatomy (6 components) | Phase 3 | Critical |
| CLI for Sidekick building | Phase 1, Phase 4 | High |
| Feed RSS/podcast | Phase 1 | High |
| Agent-writable memory | Phase 4 | High |
| Rich Agent Editor | Phase 4 | High |
| Chrome Extension | Phase 6 | Medium |
| Email input | Phase 9 | Medium |
| Sidekick adaptive routing | Phase 4 | Medium |
