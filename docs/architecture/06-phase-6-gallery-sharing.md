# Phase 6 — Gallery, Remix & Community (Week 5-7)

Goal: Build the agent marketplace. Users discover, install, remix, and share agents.

## 6.1 Gallery Architecture

The Gallery is both local and remote:

**Local Gallery**: agents installed on your machine (`~/.magically/agents/`)
**Remote Gallery**: a public registry of community-published agents

```
┌─────────────────────────────────────────────┐
│               GALLERY SERVICE                │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Registry │  │ Search   │  │ CDN      │  │
│  │ (agent   │  │ (full    │  │ (agent   │  │
│  │  metadata,│  │  text +  │  │  bundles,│  │
│  │  versions,│  │  semantic│  │  icons,  │  │
│  │  ratings) │  │  search) │  │  previews│  │
│  └──────────┘  └──────────┘  └──────────┘  │
│                                              │
│  REST API: api.magically.run/gallery         │
└─────────────────────────────────────────────┘
         ↕
┌─────────────────────────────┐
│     LOCAL RUNTIME            │
│  Downloads, installs,        │
│  manages local copies        │
└─────────────────────────────┘
```

### Gallery API:

```
GET    /gallery/agents                — Browse/search agents
GET    /gallery/agents/:id            — Agent details (description, screenshots, reviews)
GET    /gallery/agents/:id/download   — Download agent bundle (.tar.gz)
POST   /gallery/agents                — Publish an agent (authenticated)
PUT    /gallery/agents/:id            — Update published agent
GET    /gallery/categories            — List categories
GET    /gallery/featured              — Curated featured agents
```

### Agent Bundle Format (for distribution):

```
calendar-hero-1.0.0.tar.gz
  ├── manifest.json
  ├── prompt.md
  ├── widget.json
  ├── ui/
  │   └── App.tsx
  ├── icon.png               # 512x512 icon
  ├── screenshots/            # Preview images
  │   ├── desktop.png
  │   └── mobile.png
  └── README.md               # Description for gallery listing
```

## 6.2 Remix System

Any gallery agent can be remixed (forked and modified):

```
User finds "Courtside" (NBA basketball agent) in Gallery
  → User clicks "Remix"
  → Agent is cloned into ~/.magically/agents/courtside-remix/
  → Sidekick opens in Edit mode
  → User says: "Make it work for English Premier League soccer"
  → Sidekick reads the existing agent code
  → Sidekick identifies:
      - Need to swap NBA tool for Soccer tool
      - Change data queries from basketball to soccer
      - Update UI labels, colors, branding
      - Change text-to-speech accent to British
  → Sidekick makes all changes
  → New agent: "Matchday" (or whatever user names it)
  → User can keep it private OR publish back to Gallery
```

### Remix Tracking:

```jsonc
// In manifest.json of a remixed agent:
{
  "remixOf": {
    "id": "courtside",
    "version": "1.2.0",
    "author": "dreamer-team",
    "galleryUrl": "https://magically.run/gallery/courtside"
  }
}
```

This enables:
- Attribution chain (remix of remix of remix)
- Update notifications ("The original agent updated, want to merge?")
- Community metrics (most-remixed agents)

## 6.3 Publishing Flow

```
User has a local agent they want to share
  → User clicks "Publish to Gallery" in agent settings
  → Runtime bundles the agent (manifest + code + assets)
  → Runtime runs security checks:
      - No hardcoded API keys or secrets
      - No malicious code patterns
      - CSP-compliant UI code
      - Required files present
  → User writes description, selects category, adds screenshots
  → Bundle uploaded to Gallery service
  → Review queue (initially manual, later automated)
  → Published and searchable
```

### Security Model for Gallery Agents:

Gallery agents run in the same sandbox as local agents (iframe, CSP). But additional checks:
- **Static analysis** on published agent code (no fetch to unknown domains, no eval abuse)
- **Capability declaration** — agent must declare all tools it uses in manifest
- **Runtime enforcement** — agent can only call tools listed in its manifest
- **User consent** — on install, user sees: "This agent will access: Calendar, Email, Web Search. Allow?"
- **Community reporting** — flag malicious agents

## 6.4 Tool Marketplace (Future)

Third-party developers can build and publish tools:

```
Attain Finance (company) builds a tool:
  - Connects to financial institutions (Plaid integration)
  - Provides: account balances, transactions, spending categories
  - Publishes to Tool Gallery

Users install the Attain Finance tool:
  - Connects their bank accounts via OAuth
  - Tool becomes available to all their agents

Agent builders use the tool:
  - Build "Budget Tracker" agent using Attain Finance tool
  - Publish to Gallery
  - Anyone who installs it gets prompted to connect Attain Finance
```

Tool monetization:
- Free tools (open source, community)
- Freemium tools (free trial, paid at scale)
- Tool developers set pricing, Gallery takes a cut

## 6.5 Deliverables

- [ ] Gallery browse/search UI with categories and filters
- [ ] Agent detail page (description, screenshots, reviews, install count)
- [ ] One-click install from Gallery → local agent
- [ ] Remix flow: clone → Sidekick edit → save as new agent
- [ ] Remix attribution tracking in manifest
- [ ] Publish flow: bundle → validate → upload → review → publish
- [ ] Gallery API service (can be simple: GitHub releases + JSON registry initially)
- [ ] Agent bundle format (.tar.gz) with validation
- [ ] Security checks for published agents
- [ ] User ratings and reviews
- [ ] "Featured" and "Trending" sections
- [ ] Permission consent dialog on agent install
