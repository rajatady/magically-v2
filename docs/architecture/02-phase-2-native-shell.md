# Phase 2 — Native Shell & System Integration (Week 1-2)

Goal: Wrap the React app in native macOS shell. Make it feel like a real OS-level app, not a website.

## 2.1 macOS Shell (Swift)

### What the shell provides:
- **Menu bar icon** — always visible, click to open main window or quick actions
- **Global hotkey** — Cmd+Shift+Space (configurable) to summon Sidekick from anywhere
- **Native notifications** — agents push notifications via the runtime → shell bridges to UserNotifications
- **Login item** — starts on boot, runs in background
- **File drag & drop** — drop files onto the app or dock icon → routes to appropriate agent
- **Share extension** — share from any app → pick an agent to handle it
- **Spotlight integration** — search agents and actions from Spotlight (later)
- **Background runtime management** — shell starts/stops the Bun runtime process

### Architecture:

```
┌──────────────────────────────┐
│     Swift App (AppKit)       │
│  ┌────────────────────────┐  │
│  │  NSStatusItem (tray)   │  │
│  ├────────────────────────┤  │
│  │  NSWindow              │  │
│  │  ┌──────────────────┐  │  │
│  │  │  WKWebView       │  │  │
│  │  │  (React app)     │  │  │
│  │  └──────────────────┘  │  │
│  ├────────────────────────┤  │
│  │  ProcessManager        │  │
│  │  (manages Bun runtime) │  │
│  ├────────────────────────┤  │
│  │  NativeBridge          │  │
│  │  (JS ↔ Swift via       │  │
│  │   WKScriptMessage)     │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### Native Bridge API (JS ↔ Swift):

```swift
// Swift → JS (inject events into React app)
webView.evaluateJavaScript("window.__magically__.onNativeEvent({type: 'hotkey', payload: {}})")

// JS → Swift (React app requests native capabilities)
// Called via: window.webkit.messageHandlers.magically.postMessage({...})
enum NativeAction {
    case showNotification(title: String, body: String, agentId: String)
    case setBadgeCount(Int)
    case openFileDialog(types: [String])
    case setLoginItem(enabled: Bool)
    case getSystemInfo  // dark mode, locale, timezone
    case minimize
    case hide
}
```

### Window Behavior:
- Main window: ~1200x800 default, resizable, remembers position
- Can be popped out as floating panel (always on top, smaller)
- Sidekick can be invoked as a standalone floating window via hotkey
- Frameless window with custom traffic lights positioned inside the sidebar

## 2.2 Runtime Process Management

The macOS shell manages the Bun runtime as a child process:

```
App Launch:
  1. Shell starts
  2. Shell spawns: `bun run packages/runtime/src/server.ts`
  3. Shell waits for health check: GET localhost:4321/health
  4. Shell loads WKWebView pointing to localhost:4321
  5. Shell is ready

App Quit:
  1. Shell sends SIGTERM to Bun process
  2. Bun gracefully shuts down (flushes SQLite WAL)
  3. Shell exits

Runtime Crash:
  1. Shell detects process exit
  2. Shell shows "Restarting..." indicator
  3. Shell respawns Bun process
  4. Shell reloads WebView on health check pass
```

## 2.3 Notifications System

```
Agent Runtime                  Swift Shell                    macOS
─────────────                  ───────────                    ─────
agent triggers event     →
                               receives via WebSocket   →
                               creates UNNotification   →     shows banner
                                                        ←     user clicks
                               posts to WKWebView       →
React app navigates to agent
```

## 2.4 Deliverables

- [ ] Swift macOS app with WKWebView
- [ ] Menu bar icon with quick actions dropdown
- [ ] Global hotkey (Cmd+Shift+Space) for Sidekick
- [ ] Bun runtime process management (start, stop, restart, health check)
- [ ] Native bridge (JS ↔ Swift message passing)
- [ ] macOS notifications from agent events
- [ ] Login item (start on boot)
- [ ] File drop handling (dock icon + window)
- [ ] DMG distribution build
- [ ] Auto-updater (Sparkle framework)
