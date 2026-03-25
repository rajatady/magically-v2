# Phase 8 — Polish, Performance & Scale (Week 10-14)

Goal: Production hardening. Make it fast, reliable, beautiful, and ready for thousands of users.

## 8.1 Performance

### Widget Rendering Performance
- Widget data fetched in parallel on Home load
- Stale-while-revalidate: show cached data immediately, refresh in background
- Virtual grid: only render visible widgets (important for users with 20+ agents)
- Widget refresh intervals respected (don't poll faster than spec says)

### Agent UI Performance
- Iframe lazy loading: agent UI only loads when opened
- Agent bundle caching: once loaded, keep in memory
- Code splitting within agent UIs (agent SDK provides lazy loading helpers)
- Preload agent UI when widget is hovered (predictive loading)

### Runtime Performance
- SQLite WAL mode (concurrent reads during writes)
- Connection pooling for external APIs
- LLM response streaming (SSE) — never wait for full response
- Agent trigger debouncing (don't fire same trigger twice in quick succession)
- Background task queue with priority levels

### Startup Time
- Target: <1 second from app launch to Home visible
- Runtime pre-warming: start Bun before WebView loads
- SQLite query cache: pre-fetch common queries on startup
- Widget data prefetch during splash screen

## 8.2 Offline Support

```
Full offline mode:
  - Home renders with cached widget data
  - Feed shows cached items
  - Agents with local data work fully
  - Sidekick shows "Offline — limited functionality"
  - Queued actions execute when back online

Sync strategy:
  - Optimistic updates: act locally, sync later
  - Conflict resolution: last-write-wins for simple data, manual merge for complex
  - Sync log: every mutation is logged, replayed on reconnect
```

## 8.3 Security Hardening

### Agent Sandboxing
- CSP headers enforced: no external script loading, no eval
- iframe sandbox: `allow-scripts allow-forms` only (no `allow-same-origin`)
- Agent SDK bridge validates all messages (type checking, schema validation)
- Rate limiting on agent → runtime calls (prevent runaway agents)
- Resource limits: max memory per agent iframe, max API calls per minute

### Data Security
- SQLite database encrypted at rest (sqlcipher)
- OAuth tokens stored in OS keychain (macOS Keychain, Windows Credential Manager)
- API keys never sent to agent iframes (only runtime has access)
- Network requests from agents are proxied through runtime (agents can't make direct calls)

### Privacy
- All data local by default
- Gallery publishing strips personal data from agent code
- Sidekick memory is encrypted, never uploaded
- Analytics are opt-in only, anonymized

## 8.4 Accessibility

- Full keyboard navigation (Tab through widgets, Enter to open, Escape to close)
- Screen reader support (ARIA labels on all interactive elements)
- High contrast mode
- Reduced motion mode (respects `prefers-reduced-motion`)
- Font scaling
- Sidekick voice input/output for hands-free use

## 8.5 Theming & Personalization

```typescript
interface ThemeConfig {
  mode: 'dark' | 'light' | 'auto';
  accent: string;              // user-chosen accent color
  font: 'default' | 'mono' | 'serif' | 'dyslexic';
  widgetStyle: 'glass' | 'solid' | 'outlined' | 'minimal';
  sidebarPosition: 'left' | 'right';
  homeLayout: 'grid' | 'list' | 'masonry';
  animationsEnabled: boolean;
}
```

Users should be able to make it feel like THEIR OS. Not just dark/light toggle.

## 8.6 Agent Audio Capabilities

From the Dreamer videos, audio is a first-class surface:
- Calendar Hero pushes daily briefings to Apple Podcasts
- Sports agents generate audio summaries with locale-appropriate accents
- Agents can use text-to-speech tools to generate audio content
- Audio can be pushed to podcast apps via RSS feed generation

```typescript
// Agent SDK audio helpers
const { generateAudio, createPodcastFeed } = useAudio();

// Generate speech
const audio = await generateAudio({
  text: briefingText,
  voice: 'british-male',      // voice selection
  format: 'mp3'
});

// Create/update a personal podcast feed
await createPodcastFeed({
  title: 'My Daily Briefing',
  episodes: [{ title: 'Monday Briefing', audio, date: new Date() }]
});
// Feed URL: localhost:4321/feeds/daily-briefing/rss.xml
// User adds this URL to Apple Podcasts / Spotify / any podcast app
```

## 8.7 Deliverables

- [ ] Widget data caching + stale-while-revalidate
- [ ] Virtual widget grid (handle 50+ widgets smoothly)
- [ ] Agent iframe lazy loading + predictive preloading
- [ ] Startup time optimization (<1s to Home)
- [ ] Offline mode with sync queue
- [ ] SQLite encryption at rest
- [ ] Agent sandbox hardening (CSP, rate limits, resource limits)
- [ ] Full keyboard navigation
- [ ] Screen reader support
- [ ] Theme system (dark/light/auto + accent colors + layout options)
- [ ] Agent audio generation (TTS, podcast feed creation)
- [ ] RSS feed server for personal podcasts
- [ ] Performance monitoring (track widget render times, API latencies)
- [ ] Error reporting + crash recovery
- [ ] End-to-end test suite
