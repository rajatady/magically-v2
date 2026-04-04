# @magically/shared Package

Last synced: 2026-04-04

## Package

| Field | Value |
|-------|-------|
| Name | `@magically/shared` |
| Version | `0.1.0` |
| Private | `true` |
| Main | `./dist/types.js` |
| Types | `./dist/types.d.ts` |
| Build | `tsc -b` (plain TypeScript project references, no bundler) |
| Dev | `tsc -b --watch` |
| Typecheck | `tsc --noEmit` |
| Test | `jest` |
| Dependencies | `rxjs ^7.8.2`, `zod ^3.24.1` |

## tsconfig

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Inherits `Node16` module/resolution from `tsconfig.base.json`. Output is CJS (no `"type": "module"` in package.json).

## Subpath Exports

Every export uses the `"default"` condition only (no `"import"` / `"require"` split). This is the only configuration that works across NestJS (CJS), Vite (ESM via commonjsOptions), and bun.

| Subpath | Types | Default | Source file |
|---------|-------|---------|-------------|
| `.` | `./dist/types.d.ts` | `./dist/types.js` | `src/types.ts` |
| `./types` | `./dist/types.d.ts` | `./dist/types.js` | `src/types.ts` |
| `./api-client` | `./dist/api-client.d.ts` | `./dist/api-client.js` | `src/api-client.ts` |
| `./errors` | `./dist/errors/index.d.ts` | `./dist/errors/index.js` | `src/errors/index.ts` |
| `./validation` | `./dist/validation/index.d.ts` | `./dist/validation/index.js` | `src/validation/index.ts` |
| `./dockerfile` | `./dist/dockerfile.d.ts` | `./dist/dockerfile.js` | `src/dockerfile.ts` |
| `./harness` | `./dist/harness.d.ts` | `./dist/harness.js` | `src/harness.ts` |
| `./scaffold` | `./dist/scaffold.d.ts` | `./dist/scaffold.js` | `src/scaffold.ts` |

## Exported Types (`./types`)

### Auth

| Type | Kind | Fields |
|------|------|--------|
| `AuthUser` | interface | `id: string`, `email: string`, `name: string \| null`, `provider?: string` |
| `AuthResult` | interface | `user: AuthUser`, `accessToken: string` |
| `JwtPayload` | interface | `sub: string`, `email: string`, `name?: string` |
| `ApiKeyResult` | interface | `rawKey: string`, `apiKey: { id: string; name: string; keyPrefix: string }` |

### Agents

| Type | Kind | Fields |
|------|------|--------|
| `AgentFunction` | interface | `name: string`, `description: string`, `parameters: Record<string, unknown>`, `returns?: Record<string, unknown>`, `run?: string` |
| `AgentSummary` | interface | `id`, `name`, `version`, `description?`, `icon?`, `color?`, `category?`, `author?`, `status?` (`'draft' \| 'processing' \| 'building' \| 'live' \| 'failed'`), `enabled: boolean`, `hasWidget: boolean`, `functions: AgentFunction[]` |

### Triggers

| Type | Kind | Fields |
|------|------|--------|
| `CronTrigger` | interface | `type: 'cron'`, `name: string`, `entrypoint: string`, `schedule: string` |
| `EventTrigger` | interface | `type: 'event'`, `name: string`, `entrypoint: string`, `event: string` |
| `WebhookTrigger` | interface | `type: 'webhook'`, `name: string`, `entrypoint: string` |
| `AgentTrigger` | type alias | `CronTrigger \| EventTrigger \| WebhookTrigger` |

### Runs

| Type | Kind | Fields |
|------|------|--------|
| `RunLog` | interface | `level: 'info' \| 'warn' \| 'error'`, `message: string`, `data?: Record<string, unknown>`, `timestamp: number` |
| `RunResult` | interface | `runId?: string`, `agentId: string`, `functionName: string`, `status: 'success' \| 'error'`, `result?: unknown`, `error?: string`, `logs: RunLog[]`, `durationMs: number`, `startedAt: number` |

### Feed

| Type | Kind | Fields |
|------|------|--------|
| `FeedItemType` | type alias | `'info' \| 'success' \| 'warning' \| 'error' \| 'audio'` |
| `FeedItem` | interface | `id`, `agentId?`, `type: FeedItemType`, `title`, `body?`, `data?`, `audioUrl?`, `read: boolean`, `createdAt: string` |

### Registry

| Type | Kind | Fields |
|------|------|--------|
| `RegistryAgentStatus` | type alias | `'draft' \| 'live' \| 'deprecated' \| 'yanked'` |
| `RegistryVersionStatus` | type alias | `'processing' \| 'building' \| 'live' \| 'failed'` |
| `ConfigField` | interface | `type: 'string' \| 'number' \| 'boolean' \| 'array' \| 'text'`, `label: string`, `required?: boolean`, `default?: unknown` |
| `RegistryAgent` | interface | `id`, `name`, `description?`, `icon?`, `color?`, `author`, `category?`, `tags?`, `latestVersion`, `status: RegistryAgentStatus`, `installs: number`, `createdAt`, `updatedAt` |
| `RegistryVersion` | interface | `id`, `agentId`, `version`, `manifest: Record<string, unknown>`, `bundleUrl?`, `imageRef?`, `flyImageRef?`, `changelog?`, `status: RegistryVersionStatus`, `buildError?`, `publishedAt` |
| `PublishResult` | interface | `agentId`, `version`, `versionId`, `status: RegistryVersionStatus` |
| `VersionStatus` | interface | `status: RegistryVersionStatus`, `buildError?: string \| null`, `imageRef?: string \| null` |
| `UserAgentInstall` | interface | `id`, `userId`, `agentId`, `version`, `config: Record<string, unknown>`, `enabled: boolean`, `installedAt: string` |

### Widgets

*Added 2026-04-04*

| Type | Kind | Fields |
|------|------|--------|
| `UserWidget` | interface | `id: string`, `userId: string`, `agentId: string`, `size: 'small' \| 'medium' \| 'large'`, `html: string`, `position: number`, `updatedAt: string` |

### Config

| Type | Kind | Fields |
|------|------|--------|
| `AppConfig` | interface | `hasApiKey: boolean`, `defaultModel?`, `zeusName?`, `theme?`, `accentColor?` |

### Zeus

| Type | Kind | Fields |
|------|------|--------|
| `MemoryEntry` | interface | `id`, `key`, `value`, `category`, `source` |
| `ZeusTask` | interface | `id`, `requesterId`, `goal`, `status`, `priority`, `createdAt` |
| `FileAttachment` | interface | `name`, `type` (MIME), `url` (Tigris), `size` (bytes) |
| `ConversationSummary` | interface | `id`, `title`, `mode`, `agentId`, `userId`, `createdAt`, `updatedAt` |
| `ConversationMessage` | interface | `id`, `role`, `content`, `blocks?`, `sdkUuid?`, `createdAt` |
| `ConversationWithMessages` | interface | extends `ConversationSummary` + `messages: ConversationMessage[]` |

## ApiClient Class (`./api-client`)

### Constructor

```typescript
interface ApiClientConfig {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
}

class ApiClient {
  constructor(options: ApiClientConfig)
}
```

### Internal Request Method

`private async req<T>(path: string, opts?: RequestInit): Promise<T>`

- Prepends `/api` to the base URL
- Injects `Authorization: Bearer <token>` header if `getToken()` returns non-null
- Sets `Content-Type: application/json` by default
- On 401: calls `onUnauthorized()` callback, then throws `Error('Unauthorized')`
- On any non-ok response: throws `Error('API <METHOD> <path> -> <status>: <body>')`
- Returns parsed JSON

### Method Groups

#### `auth`

| Method | HTTP | Path | Return Type |
|--------|------|------|-------------|
| `signup(email, password, name?)` | POST | `/auth/signup` | `AuthResult` |
| `login(email, password)` | POST | `/auth/login` | `AuthResult` |
| `me()` | GET | `/auth/me` | `JwtPayload` |
| `createApiKey(name)` | POST | `/auth/api-keys` | `ApiKeyResult` |
| `googleUrl()` | (no fetch) | returns `${base}/api/auth/google` | `string` |

#### `agents`

| Method | HTTP | Path | Return Type |
|--------|------|------|-------------|
| `list()` | GET | `/agents` | `AgentSummary[]` |
| `mine()` | GET | `/agents/me` | `AgentSummary[]` |
| `get(id)` | GET | `/agents/<id>` | `AgentSummary` |
| `widget(id)` | GET | `/agents/<id>/widget` | `unknown` |
| `enable(id)` | PUT | `/agents/<id>/enable` | `void` |
| `disable(id)` | PUT | `/agents/<id>/disable` | `void` |
| `run(id, functionName, payload?)` | POST | `/agents/<id>/run/<functionName>` | `RunResult` |

#### `feed`

| Method | HTTP | Path | Return Type |
|--------|------|------|-------------|
| `list(limit?)` | GET | `/feed?limit=<limit>` | `FeedItem[]` |
| `markRead(id)` | POST | `/feed/<id>/read` | `void` |
| `dismiss(id)` | POST | `/feed/<id>/dismiss` | `void` |

#### `widgets` *(added 2026-04-04)*

| Method | HTTP | Path | Return Type |
|--------|------|------|-------------|
| `list()` | GET | `/widgets` | `UserWidget[]` |
| `remove(agentId)` | DELETE | `/widgets/<agentId>` | `void` |

#### `zeus`

| Method | HTTP | Path | Return Type |
|--------|------|------|-------------|
| `createConversation(mode?)` | POST | `/zeus/conversations` | `{ id: string; mode: string }` |
| `getConversation(id)` | GET | `/zeus/conversations/<id>` | `ConversationWithMessages` |
| `listConversations(params?)` | GET | `/zeus/conversations?limit=&offset=&search=` | `ConversationSummary[]` |
| `updateConversation(id, { title })` | PATCH | `/zeus/conversations/<id>` | `ConversationSummary` |
| `deleteConversation(id)` | DELETE | `/zeus/conversations/<id>` | `void` |
| `memory()` | GET | `/zeus/memory` | `MemoryEntry[]` |
| `tasks()` | GET | `/zeus/tasks` | `ZeusTask[]` |
| `getWorkspace()` | GET | `/zeus/workspace` | `{ agent: Record<string, string> \| null }` |

#### `config`

| Method | HTTP | Path | Return Type |
|--------|------|------|-------------|
| `get()` | GET | `/config` | `AppConfig` |
| `update(partial)` | PUT | `/config` | `AppConfig` |

`update()` accepts `Partial<AppConfig & { openrouterApiKey?: string }>`.

#### `streamZeusChat` (standalone async generator)

```typescript
async *streamZeusChat(
  message: string,
  conversationId?: string,
): AsyncGenerator<{ content?: string; done?: boolean; conversationId?: string; error?: string }>
```

- Sends `POST /zeus/chat` with `{ message, conversationId }`
- Reads SSE stream (`data: <json>` lines)
- Yields parsed JSON objects as they arrive

## Error Hierarchy (`./errors`)

### Base Class

```typescript
class MagicallyError extends Error {
  constructor(message: string, phase: string, details?: string)
  toJSON(): { error, message, phase }        // user-facing
  toLog(): { error, message, phase, details, stack }  // server logs only
}
```

`message` is user-facing (never exposes vendor names or internal details). `details` is for logs only.

### Error Subclasses

| Class | Module | Phase | Constructor |
|-------|--------|-------|-------------|
| `ValidationError` | publish | `validation` | `(message, checks: Array<{check, message}>)` |
| `BundleUploadError` | publish | `upload` | `(reason, details?)` |
| `BundleDownloadError` | publish | `upload` | `(reason, details?)` |
| `DuplicateVersionError` | publish | `publish` | `(agentId, version)` |
| `ImageBuildError` | build | `build` | `(agentId, version, step, reason, details?)` |
| `RegistryPushError` | build | `registry-push` | `(reason, details?)` |
| `BuildTimeoutError` | build | `build` | `(agentId, version, elapsedSeconds)` |
| `BuildProviderUnavailableError` | build | `build` | `(details?)` |
| `BuildDispatchError` | build | `build` | `(reason, details?)` |
| `ComputeError` | compute | `compute` | `(agentId, functionName, reason, details?)` |
| `ComputeTimeoutError` | compute | `compute` | `(agentId, functionName, elapsedSeconds)` |
| `SandboxCreationError` | compute | `compute` | `(reason, details?)` |
| `ImageNotFoundError` | compute | `compute` | `(agentId, version)` |
| `SnapshotCreationError` | compute | `compute` | `(reason, details?)` |
| `AgentNotFoundError` | registry | `registry` | `(agentId)` |
| `VersionNotFoundError` | registry | `registry` | `(agentId, version)` |
| `VersionConflictError` | registry | `registry` | `(agentId, version)` |
| `OwnershipError` | registry | `registry` | `(agentId)` |
| `InstallConflictError` | registry | `registry` | `(agentId)` |
| `AuthError` | auth | `auth` | `(reason, details?)` |
| `TokenExpiredError` | auth | `auth` | `()` |
| `InsufficientPermissionsError` | auth | `auth` | `(action)` |

## Validation Pipeline (`./validation`)

### Architecture

The pipeline is built on RxJS Observables. Each check is a pure function: `(context) -> Observable<CheckResult>`. Checks run sequentially via `concatMap` to support short-circuiting and context mutation (earlier checks populate `ctx.manifest` for later checks).

### Types

```typescript
type CheckSeverity = 'error' | 'warning' | 'info';
type CheckPhase = 'pre-upload' | 'pre-build' | 'post-build';
type CheckCategory = 'structure' | 'security' | 'quality' | 'compatibility';

interface CheckMeta {
  id: string;
  name: string;
  severity: CheckSeverity;
  phase: CheckPhase;
  category: CheckCategory;
}

interface ValidationContext {
  agentDir: string;                          // absolute path
  manifest: Record<string, unknown> | null;  // populated by manifest-exists check
  files: string[];                           // discovered files
  data: Map<string, unknown>;                // pass-through accumulator
}

interface CheckResult {
  check: CheckMeta;
  passed: boolean;
  message: string;
  details?: string;
}

interface ValidationResult {
  passed: boolean;          // true if zero error-severity failures
  errors: CheckResult[];
  warnings: CheckResult[];
  infos: CheckResult[];
  all: CheckResult[];
  duration: number;         // milliseconds
}

interface ValidationCheck {
  readonly meta: CheckMeta;
  validate(ctx: ValidationContext): Observable<CheckResult>;
}
```

### ValidationPipeline Class

```typescript
class ValidationPipeline {
  constructor(checks: ValidationCheck[])
  add(check: ValidationCheck): this
  stream(ctx, phase?, options?): Observable<CheckResult>   // real-time progress
  run(ctx, phase?, options?): Promise<ValidationResult>    // aggregated result
}

interface PipelineOptions {
  shortCircuit?: boolean;  // stop after first error-severity failure
}
```

**`stream()`:** Returns an Observable that emits each `CheckResult` as it completes. Filters checks by phase if specified. On short-circuit mode, stops emitting after the first error-severity failure. Errors thrown by checks are caught and converted to failing `CheckResult`.

**`run()`:** Subscribes to `stream()`, collects all results via `toArray()`, and returns an aggregated `ValidationResult` with `passed`, `errors`, `warnings`, `infos`, `all`, and `duration`.

### Built-in Checks

| Check ID | Name | Severity | Phase | Category |
|----------|------|----------|-------|----------|
| `manifest-exists` | Manifest exists and is valid JSON | `error` | `pre-upload` | `structure` |
| `manifest-schema` | Manifest matches required schema | `error` | `pre-upload` | `structure` |
| `functions-exist` | All declared function files exist | `error` | `pre-upload` | `structure` |
| `functions-executable` | JS functions use module.exports | `error` | `pre-upload` | `structure` |
| `no-hardcoded-secrets` | No hardcoded API keys or tokens | `warning` | `pre-upload` | `security` |

**Execution order matters.** `manifest-exists` runs first and populates `ctx.manifest`. `manifest-schema` validates the manifest with Zod. Subsequent checks depend on `ctx.manifest` being non-null.

### Manifest Zod Schema (in `manifest-schema` check)

```typescript
z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  functions: z.array(z.object({
    name: z.string(),
    description: z.string(),
    run: z.string().optional(),
  })).default([]),
  runtime: z.object({
    base: z.string(),
    system: z.array(z.string()).default([]),
    install: z.string().optional(),
  }).optional(),
  secrets: z.array(z.string()).default([]),
  triggers: z.array(z.object({
    type: z.string(),
    name: z.string(),
    entrypoint: z.string(),
  })).default([]),
}).passthrough()
```

The `AgentManifest` type is exported from `./validation` (via the checks index): `type AgentManifest = z.infer<typeof ManifestSchema>`.

### Pre-built Pipeline

```typescript
function createPublishPipeline(): ValidationPipeline
```

Returns a pipeline with all 5 built-in checks in order: `manifestExists`, `manifestSchema`, `functionsExist`, `functionsExecutable`, `noHardcodedSecrets`.

## Dockerfile Generator (`./dockerfile`)

```typescript
interface RuntimeConfig {
  base: string;
  system?: string[];
  install?: string;
}

function generateDockerfile(runtime: RuntimeConfig): string
```

Generates a Dockerfile string:

```dockerfile
FROM <runtime.base>
WORKDIR /agent
COPY . /agent/
RUN apt-get update && apt-get install -y <system packages> && rm -rf /var/lib/apt/lists/*   # if system[]
RUN <install>   # if install string provided
```

## Container Harness (`./harness`)

```typescript
const HARNESS_SCRIPT: string  // exported constant containing the JS source
```

The harness is a self-contained Node.js script injected into container agents at publish time. It:

1. Reads `MAGICALLY_FUNCTION` env var
2. `require()`s `functions/<name>.js`
3. Finds a callable export (`module.exports` function, `.default`, or named export matching function name)
4. Constructs a `ctx` object from environment variables:
   - `ctx.agentId` from `MAGICALLY_AGENT_ID`
   - `ctx.agentDir` = `/agent`
   - `ctx.trigger` from `MAGICALLY_TRIGGER` (JSON)
   - `ctx.secrets` = all env vars not starting with `MAGICALLY_`
   - `ctx.log.info/warn/error` = structured JSON logging to stdout/stderr
   - `ctx.emit(event, data)` = JSON to stdout
   - `ctx.llm.ask()` = throws (not available in container mode)
5. Calls `handler(ctx, trigger.payload)`
6. On success: prints `{ _result: <value> }` to stdout, exits 0
7. On error: prints `{ _error: <message>, stack: <stack> }` to stderr, exits 1

## Scaffold Utility (`./scaffold`)

```typescript
interface ScaffoldVars {
  agentId: string;
  agentName: string;
  agentDescription: string;
}

function getTemplatePath(): string
function scaffoldAgent(targetDir: string, vars: ScaffoldVars): void
```

**`getTemplatePath()`:** Returns `<dist>/../templates/agent/` (templates directory relative to compiled output).

**`scaffoldAgent()`:** Copies the template directory recursively to `targetDir`. Text files (json, js, ts, md, txt, yaml, yml, toml, cfg, gitignore, dotfiles) have `{{agentId}}`, `{{agentName}}`, `{{agentDescription}}` placeholders replaced. Binary files are copied as-is.

## CJS Build Setup

The shared package uses plain `tsc -b` with CJS output. This is a deliberate constraint:

1. **No `"type": "module"`** in package.json -- output must be CJS for NestJS compatibility
2. **No tsup, esbuild, or any bundler** -- plain `tsc -b` only
3. **Exports use `"default"` condition** -- both Vite and NestJS resolve via `"default"`
4. **Vite consumers** need `optimizeDeps.include` for shared subpaths + `build.commonjsOptions` to handle CJS-to-ESM at build time
5. **All tsconfigs use `Node16` module/resolution** inherited from `tsconfig.base.json`

## Known Issues

1. **`zeus.getWorkspace()` in ApiClient.** Calls `GET /zeus/workspace` but there is no corresponding runtime endpoint implementation for Zeus workspaces in the current codebase. This is dead code left from an earlier design iteration.
2. **`scaffoldAgent` is unused by CLI.** The CLI's `init` command has its own 975-line scaffolding implementation with inline templates instead of using `@magically/shared/scaffold`. The shared scaffold utility exists for Zeus workspace bootstrap use.
3. **Template directory exists but is not included in build output.** `getTemplatePath()` resolves to `<dist>/../templates/agent/`. The `templates/agent/` directory exists in the source tree with 16 files (manifest.json, functions/hello.js, AGENTS.md, CLAUDE.md, .gitignore, settings.json, 6 skill files, 4 doc files). However, `tsc -b` only compiles `.ts` files to `dist/` -- the template directory must be copied separately for `scaffoldAgent()` to work at runtime.
