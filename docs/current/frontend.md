# Frontend Architecture

Last synced: 2026-04-03 | Commit: ea00cd7

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | React 19 (Vite) |
| Routing | react-router-dom v6 |
| State | Zustand |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Markdown | Streamdown |
| Realtime | Socket.IO (two separate connections) |
| API Client | `@magically/shared/api-client` |
| Dev Port | 5173 (proxies /api and /socket.io to :4321) |

## Route Table

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| `/login` | `LoginPage` | No | Login screen |
| `/auth/callback` | `AuthCallbackPage` | No | OAuth callback handler |
| `/` | `HomeView` | Yes | Home dashboard with widget cards for installed agents |
| `/feed` | `FeedView` | Yes | Activity feed from agents |
| `/gallery` | `GalleryView` (My Agents tab) | Yes | User's own agents (drafts + live) from API |
| `/gallery/explore` | `GalleryView` (Explore tab) | Yes | Static explore data, editorial layout |
| `/gallery/:agentId` | `GalleryDetailRoute` -> `AgentDetail` | Yes | Gallery agent detail page |
| `/agents/:agentId` | `AgentView` | Yes | Running agent view (iframe or placeholder) |
| `/zeus` | `HomeView` (Zeus panel auto-opens) | Yes | Opens Zeus panel over home |
| `/zeus/:chatId` | `HomeView` (Zeus panel auto-opens) | Yes | Opens Zeus panel with loaded conversation |
| `/chats` | `ChatsPage` → `ChatList` | Yes | Conversation history list |
| `/chat/new` | `NewChatPage` | Yes | Creates conversation, redirects to `/chat/:id` |
| `/chat/:id` | `ChatPage` → `ChatList` + `ChatView` | Yes | Full-page chat with sidebar |
| `/settings` | `PlaceholderView("Settings")` | Yes | Placeholder |
| `/build` | `PlaceholderView("Build")` | Yes | Placeholder |

## Component Hierarchy

```
ErrorBoundary
  BrowserRouter
    TooltipProvider
      Routes
        /login -> LoginPage
        /auth/callback -> AuthCallbackPage
        /* -> ProtectedRoute
          AuthenticatedApp (loads agents, feed, config; connects socket)
            Shell
              Sidebar (nav items + installed agents)
              Header (user name + logout)
              <Outlet /> (route content)
              ZeusPanel (conditional, 400px right panel)
                ZeusChat
                  ZeusHeader
                  ZeusMessages
                  ZeusInput
```

## Zustand App Store (`useStore`)

```typescript
interface AppState {
  // Navigation
  view: View;                    // 'home' | 'feed' | 'zeus' | 'agent' | 'build' | 'gallery' | 'settings'
  activeAgentId: string | null;
  zeusOpen: boolean;

  // Data
  agents: AgentSummary[];        // Installed agents (live only, from GET /api/agents)
  feed: FeedItem[];              // Activity feed items
  config: AppConfig | null;      // App config from server

  // Zeus conversation (legacy store-based, separate from socket hook)
  conversationId: string | null;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  zeusTyping: boolean;

  // Actions
  setView(view, agentId?)
  toggleZeus()
  setAgents(agents)
  setFeed(items)
  prependFeedItem(item)
  setConfig(config)
  setConversationId(id)
  addMessage(msg)
  appendToLastMessage(content)
  setZeusTyping(typing)
  markFeedRead(id)
  dismissFeedItem(id)
}
```

## Auth Store (`useAuthStore`)

Separate Zustand store in `lib/auth.ts`. Reads from localStorage at module load time.

```typescript
interface AuthState {
  token: string | null;           // JWT, persisted to localStorage('magically_token')
  user: AuthUser | null;          // { id, email, name }, persisted to localStorage('magically_user')
  isRestoring: boolean;           // True while validating stored token on startup

  isAuthenticated(): boolean;
  setAuth(token, user): void;     // Saves to localStorage + updates state
  logout(): void;                 // Clears localStorage, disconnects socket
  setRestoring(value): void;
}
```

### Auth Flow

1. `ProtectedRoute` renders on every authenticated route
2. If `isRestoring` is true (stored token exists but not validated), shows spinner and calls `auth.me()`
3. If `auth.me()` succeeds, calls `setAuth` with refreshed user data
4. If `auth.me()` fails, calls `logout()` which clears storage and redirects
5. If no token, redirects to `/login`

## API Layer

`lib/api.ts` creates a single `ApiClient` instance from `@magically/shared/api-client`. Base URL defaults to `http://localhost:4321` (overridden by `VITE_API_URL`).

```typescript
const api = new ApiClient({
  baseUrl: BASE_URL,
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => { logout(); redirect('/login'); },
});

export const { auth, agents, feed, zeus, config } = api;
```

## AuthenticatedApp Bootstrap

On mount, `AuthenticatedApp` does three things in parallel:

1. `connectSocket()` -- global Socket.IO for feed events
2. `agents.list()` -> `setAgents`
3. `feed.list(50)` -> `setFeed`
4. `config.get()` -> `setConfig`

Shows `AppSkeleton` (shimmer placeholders) until all three settle.

## Theme Tokens

Dark-only app. All tokens defined in `styles/global.css` under `@theme`.

### Magically Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-shell` | `#0a0a0b` | App background |
| `--color-bg-panel` | `#141416` | Sidebar, header, panels |
| `--color-bg-card` | `#1c1c20` | Cards, inputs |
| `--color-bg-hover` | `#26262c` | Hover states |
| `--color-accent` | `#f97316` | Primary accent (orange) |
| `--color-accent-dim` | `rgba(249,115,22,0.15)` | Subtle accent backgrounds |
| `--color-text-1` | `#f4f4f5` | Primary text |
| `--color-text-2` | `#a1a1aa` | Secondary text |
| `--color-text-3` | `#71717a` | Muted text |

### Fonts

| Token | Value |
|-------|-------|
| `--font-body` | 'DM Sans', system-ui, sans-serif |
| `--font-serif` | 'Instrument Serif', Georgia, serif |
| `--font-mono` | 'JetBrains Mono', monospace |
| `--font-sans` (shadcn) | 'Geist Variable', sans-serif |

### shadcn Integration

shadcn tokens are set directly in `:root` (no light/dark toggle). The app uses `oklch` color space for shadcn tokens. The `--radius` base is `0.625rem`.

## Sidebar Navigation

Fixed 64px wide column. Items defined in `Sidebar.tsx`:

| Icon | Label | Path |
|------|-------|------|
| `◈` | Zeus | Toggles Zeus panel |
| `⌂` | Home | `/` |
| `◎` | Feed | `/feed` |
| `⊞` | Gallery | `/gallery` |
| `+` | Build | `/build` |
| `⚙` | Settings | `/settings` |

Below the separator, up to 8 installed agents are shown as sidebar buttons, each navigating to `/agents/:agentId`.

## Zeus Chat Architecture

Zeus has two distinct socket systems:

### 1. Global Socket (`lib/socket.ts`)

- Connects to `http://localhost:4321` on app mount via `AuthenticatedApp`
- Handles: `feed:new`, `zeus:typing`, `zeus:chunk`, `zeus:done`
- Updates the Zustand store directly (legacy path for store-based messages)

### 2. Zeus Socket Hook (`hooks/use-zeus-socket.ts`)

- Connects to `/zeus` Socket.IO namespace with auth token
- Used by `ZeusChat` component directly
- Manages its own React state (not Zustand)
- Socket events: `connect`, `disconnect`, `session`, `chunk`, `tool:start`, `tool:result`, `status`, `result`, `done`, `error`, `interrupted`
- Emits: `prompt` (with text + sessionId), `interrupt`

### Stream State and Block Tree

```typescript
interface StreamState {
  blocks: ZeusBlock[];
  status: string | null;
  result: { cost, turns, durationMs, usage } | null;
  error: string | null;
}

interface ZeusBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  tool?: string;
  input?: Record<string, unknown>;
  result?: string;
  status?: 'running' | 'done' | 'error';
  parentToolUseId?: string | null;
  children?: ZeusBlock[];
}
```

Blocks arrive flat and are assembled into a tree via `parentToolUseId`. Text blocks accumulate via `applyChunk`. Tool blocks are created via `applyToolStart` and updated via `applyToolResult`.

### Message Flow

1. User types in `ZeusInput`, calls `sendMessage(text)`
2. Optimistic user message added to local `messages` state
3. `StreamState` reset, `streaming` set to true
4. Socket emits `prompt` with text + sessionId
5. Server streams back `chunk`, `tool:start`, `tool:result`, `status` events
6. `stateRef.current` mutated in place, `notify()` triggers React re-render via `setStream`
7. On `done`, final blocks extracted into a `ZeusMessage` and appended to `messages`
8. `stream` set to null, `streaming` set to false

### Session Management

- `ZeusChat` extracts `chatId` from URL via regex on `location.pathname`
- If chatId exists, loads conversation history via `zeus.getConversation(sessionId)`
- When server emits `session` event with new sessionId, navigates to `/zeus/:id` (replace)

## Scroll Behavior (`use-scroll-to-bottom`)

- Tracks scroll position via MutationObserver + ResizeObserver
- Auto-scrolls to bottom when `isAtBottom` is true and user is not actively scrolling
- 100px threshold for "at bottom" detection
- 150ms debounce for user scroll detection

## Gallery

### My Agents Tab (`/gallery`)

- Loads agents from `agentsApi.mine()` (includes drafts + live, authored by current user, plus all local agents)
- Falls back to `storeAgents` (live only) if endpoint fails
- Renders as `MyAgentRow` list with status badges
- Draft agents navigate to `/zeus`, live agents to `/gallery/:id`
- **Bug fix (2026-04-04)**: `filteredMy` was computed in a `useMemo` that did not list `myAgents` as a dependency. This caused the filtered list to remain empty even after the API call resolved. Fixed by adding `myAgents` to the `useMemo` dependency array.

### Explore Tab (`/gallery/explore`)

- Data from static `gallery-data.ts` (not API)
- Categories: filterable pills with horizontal scroll
- Layout: Hero story card (top rated) + Editorial picks (2nd-4th) + Category sections with horizontal scroll
- Search filters by name, description, category

### Gallery Detail (`/gallery/:agentId`)

- Looks up agent from combined `myAgents + exploreAgents` static lists
- Renders `AgentDetail` component with back/open/edit/install callbacks
- Install handler is currently a no-op

## Home Screen (2026-04-04 rewrite)

`HomeView.tsx` was rewritten to render agent-emitted HTML widgets from `GET /api/widgets`.

### Layout

- **Background**: Mesh gradient (dark, subtle color transitions)
- **Greeting**: Personalized greeting with current date and active agent count
- **Feed ticker**: Live ticker bar at top showing latest agent feed event with pulsing dot indicator
- **Widget grid**: 12-column CSS grid layout (matching Dreamer OS design)
  - `small` widgets = 4 columns
  - `medium` widgets = 6 columns
  - `large` widgets = 8 columns
- **Animations**: Staggered widget entrance animations, hover elevation effects

### Data Flow

1. On mount, fetches `GET /api/widgets` for current user
2. Renders each widget's raw HTML via `dangerouslySetInnerHTML`
3. Widgets contain inline SVG charts, styled with inline CSS — the agent owns presentation entirely
4. Feed ticker fetches latest feed event for the live indicator

---

## Agent View (`/agents/:agentId`)

- Looks up agent from Zustand store (live agents only)
- If agent has functions or UI, renders an iframe: `{BASE_URL}/agents/{id}/ui?token={jwt}`
- Iframe sandboxed: `allow-scripts allow-forms allow-same-origin`
- If no UI, shows placeholder with agent icon/name/description

## Known Issues

1. **Dual socket connections**: Global socket (`lib/socket.ts`) and Zeus socket hook (`use-zeus-socket.ts`) both connect independently. The global socket handles `zeus:chunk`/`zeus:done` for the legacy store path, while the hook handles its own `/zeus` namespace. This means Zeus messages flow through two separate paths.

2. **Zeus panel vs route mismatch**: Zeus opens as a side panel overlay but also has URL routes (`/zeus`, `/zeus/:chatId`). The Shell component syncs URL to panel state via `useEffect`, but closing the panel navigates away from `/zeus` to `/`. Opening Zeus from a non-neutral route (gallery, feed) preserves the current URL.

3. **Refresh loses Zeus state**: Zeus messages live in React state (not Zustand, not persisted). Refreshing the page loses the current conversation unless the URL contains a chatId, which triggers a reload from the API.

4. **Gallery detail uses static data**: `GalleryDetailRoute` looks up agents from the static `gallery-data` arrays, not the API. If a real agent ID from the API is passed, it will show "Agent not found".

5. **Agent UI endpoint returns 501**: `AgentsController.getUi()` returns a 501 status. Agent iframes will fail to load.

6. **Store messages unused by Zeus**: The Zustand store has `messages`, `conversationId`, `zeusTyping`, `addMessage`, `appendToLastMessage`, `setZeusTyping` -- but `ZeusChat` uses the `useZeusSocket` hook with its own local state instead. The store fields are only updated by the global socket events.

### Fixed Issues

- ~~**Gallery My Agents tab showed empty list after API load**~~ (fixed 2026-04-04): `GalleryView.tsx` had a `useMemo` where `filteredMy` did not include `myAgents` in its dependency array. The filtered list never recomputed after the async `agentsApi.mine()` call resolved, so the tab appeared empty even with agents present. Fix: added `myAgents` to the `useMemo` deps.
