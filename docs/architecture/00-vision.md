# Magically — Vision & Architecture Overview

## What This Is

An open-source Agent OS. The home screen for your AI agents.

Agents today are fragmented — calendar agent here, finance agent there, grocery agent somewhere else. There is no unified surface where they converge, report back, and serve you. Magically is that surface.

It is NOT a chatbot. It is NOT a dashboard. It is an operating system layer where:
- Agents live as apps with their own UI
- A widget grid gives you a glanceable home screen
- A Zeus kernel orchestrates everything and talks to all agents
- A feed shows you what agents did while you were away
- Anyone can build, remix, and share agents

## The Three Layers

```
┌─────────────────────────────────────────────┐
│              SURFACE LAYER                   │
│  Native Shell (Swift/Kotlin) — thin wrapper  │
│  System tray, notifications, hotkeys, share  │
│  extensions, background processes, file I/O  │
├─────────────────────────────────────────────┤
│                UI LAYER                      │
│  React app — the actual OS interface         │
│  Home grid, Feed, Zeus dashboard, Gallery,   │
│  Build flow, Settings                        │
│  Hosted on Vercel / Native WebView later     │
├─────────────────────────────────────────────┤
│           AGENT UI LAYER                     │
│  Each agent = React artifact in iframe       │
│  Sandboxed, self-contained, LLM-generated    │
│  Communicates with runtime via postMessage   │
├─────────────────────────────────────────────┤
│              RUNTIME LAYER                   │
│  Cloud server (Fly.io) + Local Dev server    │
│  Agent execution, tool calls, LLM routing,   │
│  PostgreSQL storage, event bus, API keys     │
│  Abstract Compute Providers (Fly, Daytona)   │
└─────────────────────────────────────────────┘
```

## Key Principles

1. **Cloud-first with Local Options.** Production runs on Vercel/Fly.io/Neon with Tigris storage for instant availability anywhere. Dev environment runs locally using Docker and local Postgres. Your personal LLM keys are routed securely via OpenRouter or direct provider APIs.

2. **Agents are React.** LLMs are exceptionally good at generating React + Tailwind. Every agent UI is a React artifact rendered in a sandboxed iframe. No Python. No DSL. No visual flow builders.

3. **Widgets are declarative.** A small JSON/DSL spec that can render natively on any platform (SwiftUI, Jetpack Compose, HTML). The widget is the agent's face on the Home grid.

4. **The shell is thin.** 90% of the product is a React web app. The native shell (macOS, iOS, etc.) is a thin wrapper providing system-level hooks. ~500-1000 lines of native code per platform.

5. **Open source, open protocol.** The agent format, widget spec, and tool interface are open standards. Anyone can build agents, tools, and alternative shells.

## Platform Strategy

### Phase 1: Cloud Runtime + Vercel Web App
- Web: React app deployed on Vercel
- Runtime: Fly.io Node server + Neon Postgres + Tigris
- Desktop: Electron or minimal native shell connecting to cloud later

### Phase 2: iOS
- Swift app with WKWebView + push notifications + share extension
- Shared Swift code with macOS shell via Swift Package

### Phase 3: Cross-platform
- Windows/Linux: Tauri wrapper (Rust shell, same React app)
- Android: Kotlin shell with WebView

The React app is IDENTICAL across all platforms. Only the native shell changes.

## Monetization (Later, Not Now)

- Premium tools in the gallery (free trial, pay at scale)
- Hosted cloud runtime for non-technical users
- Enterprise features (team sharing, audit logs, SSO)
- Marketplace cut on paid agents

The open-source core is always free. Always local-first. Always yours.
