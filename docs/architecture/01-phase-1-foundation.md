# Phase 1 — Foundation (Days 1-2)

Goal: Ship a working macOS + web app with Home, Sidekick, Feed, and one demo agent.

## What Gets Built

### 1.1 Project Scaffolding

```
magically/
├── apps/
│   ├── web/                  # React app (Next.js or Vite + React)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── shell/    # Sidebar, layout, navigation
│   │   │   │   ├── home/     # Widget grid, widget renderer
│   │   │   │   ├── feed/     # Activity feed
│   │   │   │   ├── sidekick/ # Chat panel
│   │   │   │   ├── agent/    # Agent view container (iframe host)
│   │   │   │   ├── build/    # Agent builder UI
│   │   │   │   └── gallery/  # Agent gallery browser
│   │   │   ├── lib/
│   │   │   │   ├── api.ts        # Client for runtime API
│   │   │   │   ├── events.ts     # WebSocket event listener
│   │   │   │   └── store.ts      # Zustand global state
│   │   │   └── styles/
│   │   └── package.json
│   │
│   └── macos/                # Swift native shell (Phase 1.5)
│       ├── Magically/
│       │   ├── AppDelegate.swift
│       │   ├── MainWindow.swift   # WKWebView container
│       │   ├── MenuBar.swift      # Tray icon + dropdown
│       │   └── Notifications.swift
│       └── Magically.xcodeproj
│
├── packages/
│   ├── runtime/              # The local server
│   │   ├── src/
│   │   │   ├── server.ts         # Bun/Hono HTTP + WS server
│   │   │   ├── agents/
│   │   │   │   ├── manager.ts    # Load, run, manage agents
│   │   │   │   ├── executor.ts   # Agent task execution
│   │   │   │   └── builder.ts    # LLM-powered agent creation
│   │   │   ├── sidekick/
│   │   │   │   ├── chat.ts       # Sidekick conversation handler
│   │   │   │   ├── memory.ts     # Persistent user memory
│   │   │   │   └── router.ts     # Route requests to agents/tools
│   │   │   ├── tools/
│   │   │   │   ├── registry.ts   # Tool registration and discovery
│   │   │   │   ├── builtin/      # Built-in tools
│   │   │   │   │   ├── calendar.ts
│   │   │   │   │   ├── web-search.ts
│   │   │   │   │   └── weather.ts
│   │   │   │   └── types.ts      # Tool interface definition
│   │   │   ├── llm/
│   │   │   │   ├── provider.ts   # LLM abstraction (OpenRouter, direct)
│   │   │   │   └── streaming.ts  # SSE streaming handler
│   │   │   ├── db/
│   │   │   │   ├── schema.ts     # SQLite schema
│   │   │   │   └── client.ts     # Database client (Drizzle + better-sqlite3)
│   │   │   ├── events/
│   │   │   │   └── bus.ts        # Event bus for agent → feed updates
│   │   │   └── config.ts         # User config, API keys, preferences
│   │   └── package.json
│   │
│   ├── agent-sdk/            # SDK for building agents
│   │   ├── src/
│   │   │   ├── types.ts          # Agent manifest, widget spec types
│   │   │   ├── bridge.ts         # postMessage bridge (iframe ↔ runtime)
│   │   │   ├── hooks.ts          # React hooks: useAgentData, useTool, etc.
│   │   │   └── components.ts     # Shared UI primitives for agents
│   │   └── package.json
│   │
│   └── widget-dsl/           # Widget specification
│       ├── src/
│       │   ├── types.ts          # Widget DSL type definitions
│       │   ├── renderer.tsx      # React renderer for widgets
│       │   └── validate.ts       # Schema validation
│       └── package.json
│
├── agents/                   # Built-in agents (each is self-contained)
│   ├── calendar-hero/
│   │   ├── manifest.json
│   │   ├── prompt.md
│   │   ├── widget.json
│   │   └── ui/
│   │       └── App.tsx
│   └── ...
│
├── turbo.json                # Turborepo config
├── package.json              # Root workspace
└── bun.lockb
```

### 1.2 Tech Stack Decisions

| Layer | Choice | Why |
|-------|--------|-----|
| Monorepo | Turborepo + Bun workspaces | Fast, simple, native Bun support |
| Web framework | Vite + React 19 | Fast builds, no SSR needed (local app) |
| Styling | Tailwind CSS 4 | LLMs generate excellent Tailwind. Agent artifacts use it too |
| State | Zustand | Minimal, fast, no boilerplate |
| Local server | Bun + Hono | Bun is fast, Hono is lightweight and typed |
| Database | SQLite via better-sqlite3 + Drizzle ORM | Zero-config, embedded, fast, local-first |
| LLM | OpenRouter (default) + direct provider support | One API for all models. User brings own keys |
| Real-time | WebSocket (native Bun WS) | Agent events, Sidekick streaming, feed updates |
| Agent UI | React in sandboxed iframe | LLMs excel at React generation. Iframe = security |
| Widget spec | JSON DSL → React renderer | Declarative, cross-platform renderable |

### 1.3 Runtime API Design

The runtime is a local HTTP + WebSocket server on `localhost:4321`.

```
REST API:
  GET    /api/agents                  — List all agents
  GET    /api/agents/:id              — Get agent details
  POST   /api/agents                  — Create new agent
  PUT    /api/agents/:id              — Update agent
  DELETE /api/agents/:id              — Delete agent
  GET    /api/agents/:id/widget       — Get widget data (for Home grid)
  POST   /api/agents/:id/action       — Trigger agent action

  GET    /api/feed                    — Get feed items
  POST   /api/feed/:id/action         — Act on a feed item (dismiss, approve)

  POST   /api/sidekick/chat           — Send message to Sidekick (SSE streaming response)
  GET    /api/sidekick/memory         — Get Sidekick memory entries

  GET    /api/tools                   — List available tools
  POST   /api/tools/:id/execute       — Execute a tool directly

  GET    /api/config                  — Get user config
  PUT    /api/config                  — Update config (API keys, preferences)

WebSocket: ws://localhost:4321/ws
  Events:
    agent:update     — Agent pushed new widget data
    feed:new         — New feed item from an agent
    sidekick:typing  — Sidekick is generating
    sidekick:message — Sidekick response chunk (streaming)
    agent:build:log  — Build progress during agent creation
```

### 1.4 Agent Manifest Format

```jsonc
// agents/calendar-hero/manifest.json
{
  "id": "calendar-hero",
  "name": "Calendar Hero",
  "version": "1.0.0",
  "description": "Meeting prep & daily briefings",
  "icon": "📅",                          // emoji or path to icon
  "color": "#3b82f6",                    // theme color
  "author": "magically",

  "tools": ["google-calendar", "web-search", "text-to-speech"],

  "triggers": {
    "schedule": "0 7 * * *",             // cron: run every morning at 7am
    "event": ["calendar:event-starting"]  // react to calendar events
  },

  "ui": {
    "entry": "ui/App.tsx",               // main agent UI
    "widget": "widget.json"              // home screen widget spec
  },

  "permissions": {
    "data": ["calendar", "contacts", "email"],
    "actions": ["send-notification", "create-audio"]
  }
}
```

### 1.5 Widget DSL

```jsonc
// agents/calendar-hero/widget.json
{
  "size": "medium",            // small (1x1), medium (2x1), large (2x2), tall (1x2), wide (3x1)
  "refresh": "1m",             // how often to refresh data
  "theme": "auto",             // auto | light | dark

  "data": {
    "source": "agent",         // fetch from agent's data endpoint
    "endpoint": "/widget-data"
  },

  "layout": {
    "type": "stack",           // stack | grid | list | custom
    "children": [
      {
        "type": "header",
        "icon": "{{agent.icon}}",
        "title": "{{agent.name}}",
        "badge": { "text": "LIVE", "color": "blue" }
      },
      {
        "type": "list",
        "items": "{{data.events}}",
        "template": {
          "type": "row",
          "children": [
            { "type": "color-bar", "color": "{{item.color}}" },
            {
              "type": "stack",
              "children": [
                { "type": "text", "value": "{{item.title}}", "style": "body-bold" },
                { "type": "text", "value": "{{item.time}} · {{item.duration}}", "style": "caption" }
              ]
            },
            {
              "type": "badge",
              "text": "{{item.status}}",
              "color": "{{item.statusColor}}",
              "visible": "{{item.status != null}}"
            }
          ]
        }
      }
    ]
  }
}
```

This DSL:
- Can be rendered by the React widget renderer (web/macOS WebView)
- Can be transpiled to SwiftUI for native iOS/macOS widgets
- Can be transpiled to Jetpack Compose for Android
- Is simple enough that LLMs can generate it

### 1.6 Day 1 Deliverables

- [ ] Monorepo scaffolded (Turborepo + Bun)
- [ ] Vite + React app with shell layout (Sidebar, Home, Feed, Sidekick panel)
- [ ] Runtime server running on localhost with SQLite
- [ ] REST + WebSocket API skeleton
- [ ] LLM provider abstraction (OpenRouter integration)
- [ ] Sidekick chat working (send message → stream response)
- [ ] Widget DSL types + React renderer
- [ ] Home grid with hardcoded demo widgets

### 1.7 Day 2 Deliverables

- [ ] Agent manifest format finalized
- [ ] Agent loading from filesystem (scan `agents/` directory)
- [ ] Agent UI rendering in sandboxed iframe
- [ ] Agent SDK with postMessage bridge + React hooks
- [ ] One complete demo agent (Calendar Hero or a simpler one)
- [ ] Feed system: agents push events → feed displays them
- [ ] Build flow: describe agent → Sidekick generates manifest + UI
- [ ] Basic config UI (enter API keys, set preferences)
- [ ] README + quick start guide
- [ ] Ship to GitHub
