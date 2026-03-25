# Phase 10 — Endgame: The Agent Protocol (Week 16+)

Goal: Define and evangelize the open standard. Make Magically the default OS for AI agents, the way Android became the default OS for phones.

## 10.1 The Magically Agent Protocol (MAP)

An open specification that any platform can implement:

```yaml
Protocol: MAP v1
Status: Draft

Components:
  1. Agent Manifest Spec
     - How agents declare their identity, capabilities, and requirements
     - JSON format, versioned, backward-compatible

  2. Widget Spec
     - How agents define glanceable UI for home screens
     - Declarative DSL, renderable on any platform

  3. Tool Interface
     - How tools expose capabilities to agents
     - JSON Schema for parameters, typed responses
     - Auth flow specification (OAuth2, API key)

  4. Agent SDK Contract
     - Standard hooks/APIs for agent ↔ runtime communication
     - Data access, tool calls, feed events, widget updates
     - Sidekick Task delegation

  5. Sandbox Spec
     - Security model for running untrusted agent code
     - CSP rules, resource limits, permission model

  6. Gallery Interchange Format
     - Bundle format for distributing agents
     - Signing, verification, dependency resolution
```

If this protocol gets adopted:
- Any agent built for Magically works on any MAP-compatible runtime
- Other companies can build MAP-compatible shells (desktop, wearable, car, TV)
- Tool developers build once, work everywhere
- Agent developers publish once, run everywhere

This is the Android play. Not the hardware, not the skin — the protocol.

## 10.2 Voice & Conversational Interface

Beyond chat and visual UI:

```
Voice Modes:
  1. Push-to-talk Sidekick (hold hotkey, speak, release)
  2. Always-listening mode (like Alexa, but local, private)
  3. Phone call interface (call a number, talk to Sidekick)
  4. AirPods/wearable integration (tap to activate)

Architecture:
  Microphone → Local STT (Whisper.cpp on-device) → Sidekick → TTS → Speaker

  Privacy: voice never leaves device unless user opts into cloud STT
  Latency target: <500ms from end-of-speech to start-of-response
```

## 10.3 Wearable Integration

### Apple Watch
- Complications showing agent widget data
- Raise-to-talk Sidekick
- Notification actions (approve Sidekick Tasks from wrist)

### Smart Displays
- Home grid rendered as ambient display
- Agents cycle through content (weather, calendar, news, photos)
- Voice-first interaction

## 10.4 Developer Platform

For power users who want to build tools and agents programmatically:

```
CLI:
  $ magically init my-agent          # scaffold new agent
  $ magically dev                    # hot-reload dev server
  $ magically build                  # bundle for distribution
  $ magically publish                # push to Gallery
  $ magically install courtside      # install from Gallery
  $ magically remix courtside        # fork an agent

SDK:
  npm install @magically/agent-sdk
  npm install @magically/tool-sdk
  npm install @magically/widget-dsl

API:
  Full REST API documentation at docs.magically.run
  WebSocket event reference
  Tool development guide
  Agent development guide
```

## 10.5 Enterprise Features (Revenue)

```
Magically for Teams:
  - Shared agent library within organization
  - Admin-managed tool connections (SSO for integrations)
  - Audit logs (who used what agent, when, with what data)
  - Agent approval workflow (admin approves before team can use)
  - Custom LLM deployment (Azure OpenAI, on-prem models)
  - Data residency controls
  - Priority support

Pricing:
  - Personal: Free forever (open source, local-first)
  - Cloud: $10-20/mo (hosted runtime, sync, mobile-only access)
  - Teams: $30-50/user/mo (shared agents, admin controls, audit)
  - Enterprise: Custom (on-prem, compliance, SLA)
```

## 10.6 Moonshot: Agent-to-Agent Economy

What happens when agents can transact:

```
Your Smart Groceries agent notices you're low on eggs
  → It asks your Health Coach agent what egg-based meals fit your macros
  → Health Coach responds with 3 recipes
  → Smart Groceries checks Instacart for best prices
  → It proposes a cart + meal plan for the week
  → You approve with one tap
  → Groceries ordered, meals planned, macros optimized

None of these agents were designed to work together.
They compose because they share the protocol, the runtime, and the Sidekick.
```

This is the endgame. Not one super-app. A protocol that makes thousands of specialized agents compose into something greater than any single product could be.

## 10.7 Full Phase Summary

| Phase | What | When | Ship |
|-------|------|------|------|
| 1 | Foundation (monorepo, React app, runtime, Sidekick chat, Home grid) | Day 1-2 | GitHub + web |
| 2 | macOS native shell (tray, hotkey, notifications, process mgmt) | Week 1-2 | DMG |
| 3 | Agent system (lifecycle, sandbox, SDK, tools, Sidekick Tasks) | Week 2-3 | — |
| 4 | Sidekick intelligence (memory, builder, proactive, orchestration) | Week 3-4 | — |
| 5 | iOS + mobile (companion mode, WidgetKit, share extension, push) | Week 4-6 | TestFlight |
| 6 | Gallery & remix (browse, install, fork, publish, community) | Week 5-7 | Gallery web |
| 7 | Cross-platform (Windows, Linux via Tauri; Android) | Week 7-10 | All platforms |
| 8 | Polish (performance, offline, security, accessibility, themes) | Week 10-14 | — |
| 9 | Cloud & social (hosted runtime, accounts, sharing, integrations) | Week 12-16 | Cloud launch |
| 10 | Endgame (open protocol, voice, wearables, dev platform, enterprise) | Week 16+ | Ongoing |

The first two phases ship in 2 days. Everything else follows fast because the architecture is right from day one.
