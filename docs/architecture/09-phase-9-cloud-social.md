# Phase 9 — Cloud Runtime & Social (Week 12-16)

Goal: Optional cloud layer for users who want mobile-only access, sharing, and collaboration.

## 9.1 Cloud Runtime (Optional, Paid)

For users who don't want to run a Mac/PC 24/7 but want agents running in the background:

```
┌─────────────────────────────────────────┐
│           CLOUD RUNTIME                  │
│  (Same Bun runtime, hosted)              │
│                                          │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Agent   │ │ Sidekick │ │ Trigger  │ │
│  │ Executor│ │ Memory   │ │ Scheduler│ │
│  └─────────┘ └──────────┘ └──────────┘ │
│                                          │
│  ┌──────────┐ ┌──────────────────────┐  │
│  │ SQLite   │ │ Push Notification    │  │
│  │ (Turso)  │ │ Service (APNs/FCM)  │  │
│  └──────────┘ └──────────────────────┘  │
│                                          │
│  Accessible from any device via API      │
│  Syncs with local runtime when online    │
└─────────────────────────────────────────┘
```

### Deployment Options:
1. **Magically Cloud** — we host it, user pays subscription
2. **Self-hosted** — Docker image, deploy to Railway/Fly/VPS
3. **Hybrid** — local runtime primary, cloud for background tasks only

### Sync Protocol:
```
Local Runtime ←→ Cloud Runtime

Sync direction: bidirectional
Conflict resolution: last-write-wins with vector clock
What syncs:
  - Agent installations and configurations
  - Sidekick memory
  - Feed events
  - Widget data cache
What doesn't sync:
  - Agent source code (only manifest references)
  - OAuth tokens (re-auth on each device)
  - LLM conversation history (too large, privacy-sensitive)
```

## 9.2 User Accounts & Identity

For Gallery publishing and cloud features:

```
Authentication:
  - GitHub OAuth (primary — our users are developers first)
  - Google OAuth
  - Email + magic link
  - No passwords

Profile:
  - username (unique, used in Gallery URLs)
  - display name
  - avatar
  - bio
  - published agents
  - installed agents (private)
```

## 9.3 Sharing & Collaboration

### Agent Sharing (Simple)
- Share a link: `magically.run/agent/calendar-hero`
- Recipient clicks → agent installs locally
- No account needed to install, only to publish

### Home Sharing (Show, Don't Edit)
- Share a snapshot of your Home layout
- Read-only view: others can see your widget arrangement + agent choices
- Inspiration-oriented, like sharing your phone home screen
- Privacy: user controls which widgets are visible in shared view

### Collaborative Agents (Later)
- Shared agent instance between family members / team
- Example: Smart Groceries shared by a household
- Shared data (fridge inventory), individual preferences (dietary restrictions)
- Permission model: owner, editor, viewer

## 9.4 Social Features

### Gallery Social
- Follow agent creators
- Agent collections ("My Productivity Stack", "Family Essentials")
- Weekly "Agent of the Week" feature
- Community showcase: "What I Built" posts

### Agent Analytics (for creators)
- Install count
- Active user count
- Remix count
- Rating distribution
- Error reports

## 9.5 API Keys & Integration Hub

Centralized management for all external service connections:

```
Integration Hub:
  ┌──────────────────────────────────────────┐
  │  Connected Services                       │
  │                                           │
  │  ✅ Google Calendar    [Manage] [Revoke]  │
  │  ✅ Gmail              [Manage] [Revoke]  │
  │  ✅ Slack              [Manage] [Revoke]  │
  │  ✅ Instacart          [Manage] [Revoke]  │
  │  ⬚  Spotify           [Connect]          │
  │  ⬚  WhatsApp          [Connect]          │
  │                                           │
  │  LLM Provider                             │
  │  ✅ OpenRouter (claude-sonnet-4-6)        │
  │     API Key: sk-...****  [Change]         │
  │     Usage this month: $4.23               │
  │                                           │
  │  Or: Direct provider keys                 │
  │  ⬚  Anthropic         [Add Key]          │
  │  ⬚  OpenAI            [Add Key]          │
  │  ⬚  Google AI         [Add Key]          │
  └──────────────────────────────────────────┘
```

## 9.6 Deliverables

- [ ] Cloud runtime Docker image (same codebase as local)
- [ ] Magically Cloud hosting service (managed deployment)
- [ ] Self-hosted deployment guide + Docker Compose
- [ ] Bidirectional sync between local and cloud runtime
- [ ] User authentication (GitHub OAuth, Google OAuth, magic link)
- [ ] Gallery user profiles
- [ ] Agent sharing via URL
- [ ] Home layout sharing (read-only snapshots)
- [ ] Integration Hub UI (manage all service connections in one place)
- [ ] Agent analytics dashboard for creators
- [ ] Community features (follow, collections, showcase)
