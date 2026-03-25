# Phase 7 — Cross-Platform Expansion (Week 7-10)

Goal: Windows, Linux, Android. Magically runs everywhere your life happens.

## 7.1 Desktop: Windows + Linux via Tauri

The React app is identical. Only the shell changes.

### Tauri 2.0 Shell:

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Spawn Bun runtime as child process
            // Setup system tray
            // Register global hotkey
            // Setup auto-start
        })
        .system_tray(system_tray)
        .on_system_tray_event(handle_tray_event)
        .invoke_handler(tauri::generate_handler![
            show_notification,
            open_file_dialog,
            set_login_item,
            get_system_info,
        ])
        .run(tauri::generate_context!())
}
```

Tauri provides:
- System tray (Windows taskbar, Linux indicator)
- Global hotkey registration
- Native file dialogs
- Notifications (Windows toast, Linux libnotify)
- Auto-start on login
- Auto-updater
- Tiny binary size (~5-10MB vs Electron's ~150MB)

### Platform Parity Matrix:

| Feature | macOS (Swift) | Windows (Tauri) | Linux (Tauri) |
|---------|---------------|-----------------|---------------|
| System tray | ✅ NSStatusItem | ✅ SystemTray | ✅ AppIndicator |
| Global hotkey | ✅ Carbon/CGEvent | ✅ GlobalShortcut | ✅ GlobalShortcut |
| Notifications | ✅ UserNotifications | ✅ Toast | ✅ libnotify |
| Auto-start | ✅ LoginItem | ✅ Registry | ✅ autostart dir |
| File drop | ✅ NSDragging | ✅ Tauri DnD | ✅ Tauri DnD |
| Auto-update | ✅ Sparkle | ✅ Tauri updater | ✅ Tauri updater |
| Deep links | ✅ URL schemes | ✅ URL schemes | ✅ URL schemes |

### Shared Native Bridge Contract:

All shells implement the same bridge interface, so the React app doesn't know (or care) which shell it's in:

```typescript
// packages/web/src/lib/native-bridge.ts

interface NativeBridge {
  // Shell capabilities
  platform: 'macos' | 'windows' | 'linux' | 'ios' | 'android' | 'web';
  capabilities: Set<'tray' | 'hotkey' | 'notifications' | 'file-drop' | 'share-extension' | 'widgets'>;

  // Actions
  showNotification(title: string, body: string, agentId?: string): void;
  setBadgeCount(count: number): void;
  openFileDialog(options: FileDialogOptions): Promise<string[]>;
  setAutoStart(enabled: boolean): void;
  getSystemInfo(): Promise<SystemInfo>;

  // Events (shell → React)
  onHotkey(callback: () => void): () => void;
  onFileDrop(callback: (files: FileDropEvent) => void): () => void;
  onNotificationClick(callback: (agentId: string) => void): () => void;
  onDeepLink(callback: (url: string) => void): () => void;
}

// Implementation auto-detects platform:
export const bridge: NativeBridge = detectPlatform() === 'macos'
  ? new WebKitBridge()      // WKScriptMessageHandler
  : detectPlatform() === 'web'
  ? new WebBridge()          // No-op / browser APIs only
  : new TauriBridge();       // Tauri invoke API
```

## 7.2 Android

### Option A: Kotlin Shell + WebView (Recommended)
- Kotlin app hosting Android WebView
- Same React app
- Android-specific: home screen widgets (Glance/RemoteViews), share intent receiver, notification channels
- Widget DSL → Jetpack Compose compiler (like the SwiftUI compiler)

### Option B: React Native Shell
- If we need deeper native integration
- React Native app with embedded WebView for the main UI
- Agent UIs still run in WebView iframes

### Android-Specific Features:
- **Home screen widgets** (widget.json → Glance composables)
- **Share intent receiver** (share files/text from any app to agents)
- **Notification channels** (per-agent notification groups)
- **Quick Settings tile** (toggle Sidekick)
- **Google Assistant integration** (later — voice → Sidekick)

## 7.3 Widget DSL Cross-Platform Compilers

The widget.json spec now has renderers for every platform:

```
widget.json
    │
    ├──→ React renderer (web, macOS WebView, Windows WebView, Linux WebView)
    │      packages/widget-dsl/src/renderer.tsx
    │
    ├──→ SwiftUI compiler (iOS WidgetKit, macOS WidgetKit)
    │      packages/swift-shared/Sources/WidgetDSLCompiler.swift
    │
    ├──→ Jetpack Compose compiler (Android Glance widgets)
    │      packages/android-shared/src/WidgetDSLCompiler.kt
    │
    └──→ (Future) Windows Widgets, Linux panel widgets
```

Each compiler reads the same JSON spec and outputs platform-native UI code.

## 7.4 Cloud API Client for Mobile

Phase 5 shipped iOS with a Cloud API Client. Android follows the exact same pattern:

```
Android connects directly to the Magically Cloud Runtime (Fly.io) via REST/WebSocket APIs.
There is no local embedded runtime or local SQLite sync required on the device.
Auth is handled via JWT tokens.

Limitations vs Desktop React App:
  - Background execution is time-limited by OS (use Cloud crons instead)
```

## 7.5 Deliverables

- [ ] Tauri shell for Windows (system tray, hotkey, notifications, auto-update)
- [ ] Tauri shell for Linux (same feature set)
- [ ] Shared NativeBridge interface across all platforms
- [ ] Android app (Kotlin shell + WebView)
- [ ] Android home screen widgets (widget.json → Glance)
- [ ] Android share intent receiver
- [ ] Widget DSL → Jetpack Compose compiler
- [ ] Cloud API Client for mobile (replacing companion mode)
- [ ] Cross-platform CI/CD (build all platforms from one repo)
- [ ] Platform-specific release pipelines (DMG, MSI, AppImage, APK, TestFlight)
