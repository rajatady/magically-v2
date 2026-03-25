# Phase 5 — iOS & Mobile (Week 4-6)

Goal: Bring Magically to your pocket. Native iOS app with widgets, share extensions, notifications, and offline capability.

## 5.1 iOS App Architecture

```
┌─────────────────────────────────────────┐
│           iOS App (Swift)                │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Main App                        │   │
│  │  ┌────────────────────────────┐  │   │
│  │  │  WKWebView (React app)    │  │   │
│  │  └────────────────────────────┘  │   │
│  │  Native Bridge (WKScriptMessage) │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────┐  ┌─────────────────┐  │
│  │  Share Ext    │  │  Widget Ext     │  │
│  │  (send files  │  │  (WidgetKit -   │  │
│  │   to agents)  │  │   native iOS    │  │
│  │              │  │   home screen    │  │
│  │              │  │   widgets)       │  │
│  └──────────────┘  └─────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Background Tasks                 │   │
│  │  (BGTaskScheduler — agent crons) │   │
│  └──────────────────────────────────┘   │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Push Notifications               │   │
│  │  (APNs — agent alerts)           │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 5.2 Key Difference: Where Does the Runtime Run?

On macOS, the runtime runs locally (Bun on localhost). On iOS, we have two options:

### Option A: Embedded Runtime (Preferred)
- Bundle a lightweight JS runtime in the iOS app (JavaScriptCore or Hermes)
- SQLite runs natively on iOS
- LLM calls go to OpenRouter/API directly from device
- True local-first, no server dependency
- Limitation: no Bun, no Node APIs — need a compatible runtime subset

### Option B: Companion Mode
- iOS connects to the macOS runtime over local network (Bonjour/mDNS)
- Requires Mac to be running
- Good for Phase 5 MVP, replaced by Option A later

### Option C: Cloud Runtime (Later)
- Optional cloud-hosted runtime for users who want mobile-only
- Paid tier
- Runtime runs on user's cloud instance (Railway, Fly.io, self-hosted)

**Phase 5 ships Option B (companion mode) with Option A as a fast-follow.**

## 5.3 Native iOS Widgets (WidgetKit)

This is where the Widget DSL pays off. Each agent's `widget.json` gets compiled to a WidgetKit view:

```swift
// Auto-generated from widget.json
struct CalendarHeroWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "calendar-hero", provider: AgentWidgetProvider()) { entry in
            CalendarHeroWidgetView(entry: entry)
        }
        .configurationDisplayName("Calendar Hero")
        .description("Upcoming meetings")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct CalendarHeroWidgetView: View {
    let entry: AgentWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("📅")
                Text("Calendar Hero")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            ForEach(entry.events, id: \.id) { event in
                HStack {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color(hex: event.color))
                        .frame(width: 3, height: 32)
                    VStack(alignment: .leading) {
                        Text(event.title).font(.subheadline).bold()
                        Text("\(event.time) · \(event.duration)").font(.caption).foregroundColor(.secondary)
                    }
                    Spacer()
                    if let status = event.status {
                        Text(status)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(hex: event.statusColor).opacity(0.2))
                            .cornerRadius(4)
                    }
                }
            }
        }
        .padding()
    }
}
```

The Widget DSL → SwiftUI compiler is a build step:
1. Read `widget.json`
2. Generate Swift code
3. Compile into WidgetKit extension

This means every agent that defines a `widget.json` automatically gets a native iOS widget.

## 5.4 Share Extension

```
User is in Safari / Photos / Files / any app
  → taps Share
  → selects "Magically"
  → sees list of compatible agents
  → selects agent (e.g., "Smart Groceries" for a fridge photo)
  → share extension sends file to runtime
  → agent processes it
  → notification when done
```

## 5.5 Push Notifications

Since the runtime may not always be running on mobile:

```
Agent trigger fires (on Mac runtime or cloud)
  → Runtime sends push via APNs
  → iOS receives push
  → Shows notification: "Calendar Hero: You have a conflict at 5pm"
  → User taps → opens agent view in app
```

For companion mode, the Mac pushes notifications to the iOS app via local network.

## 5.6 Shared Swift Package

macOS and iOS shells share code via a Swift Package:

```
packages/swift-shared/
  Sources/
    MagicallyCore/
      NativeBridge.swift        # JS ↔ Swift messaging
      AgentWidgetProvider.swift  # WidgetKit data provider
      WidgetDSLCompiler.swift   # widget.json → SwiftUI
      NotificationManager.swift
      RuntimeConnection.swift   # Connect to Bun runtime
      KeychainManager.swift     # Store OAuth tokens, API keys
```

## 5.7 Deliverables

- [ ] iOS app with WKWebView hosting React app
- [ ] Companion mode: iOS connects to Mac runtime over LAN
- [ ] Share extension: share files from any app to agents
- [ ] Native iOS widgets via WidgetKit (compiled from widget.json)
- [ ] Widget DSL → SwiftUI compiler
- [ ] Push notifications from runtime to iOS
- [ ] Haptic feedback on agent interactions
- [ ] iOS-specific navigation (swipe gestures, pull to refresh)
- [ ] Face ID / Touch ID for sensitive agents (finance)
- [ ] Shared Swift Package between macOS and iOS
- [ ] TestFlight distribution
