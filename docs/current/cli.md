# Magically CLI

Last synced: 2026-04-04 | Commit: 93e7bdc (development branch)

## Package

| Field | Value |
|-------|-------|
| Name | `@magically/cli` |
| Version | `0.1.0` |
| Binary | `magically` (via `./dist/index.js`) |
| Entry point | `packages/cli/src/index.ts` |
| Build | `tsc` |
| Test | `jest --no-coverage --testPathIgnorePatterns=dist` |
| Framework | Commander.js |
| Dependencies | `@magically/shared` (workspace), `commander ^13.1.0`, `enquirer ^2.4.1` |

## Commands

### `magically login`

Authenticate with Magically.

| Option | Default | Description |
|--------|---------|-------------|
| `--base <url>` | `http://localhost:4321` | Runtime base URL |
| `--token <token>` | none | API key or JWT token (skip browser login) |

**Flow (browser OAuth):**

1. Starts a local HTTP server on port `9876`
2. Opens browser to `${WEB_URL}/login?cli_redirect=http://localhost:9876` (WEB_URL defaults to `http://localhost:5173`)
3. User authenticates in the web app (Google OAuth or other method)
4. Web app redirects to `http://localhost:9876?token=<jwt>`
5. Local server captures token, saves to `~/.magically/credentials.json`
6. Server renders a success HTML page and auto-closes after 1.5s
7. Timeout: 2 minutes. If no token received, login fails.

**Flow (direct token):**

1. `--token` flag provided: token is saved directly, no browser interaction.

**Post-login:** Calls `onLoginSuccess` callback (set by the program to show help output).

### `magically logout`

Clear stored credentials. Deletes `~/.magically/credentials.json`.

### `magically whoami`

Show the currently authenticated user.

| Option | Default | Description |
|--------|---------|-------------|
| `--base <url>` | `http://localhost:4321` | Runtime base URL |

Calls `GET /api/auth/me` with stored token. Prints `email (sub)`. Exits with code 1 if not logged in or token is invalid.

### `magically token`

Create an API key for scripts and automation.

| Option | Default | Description |
|--------|---------|-------------|
| `--base <url>` | `http://localhost:4321` | Runtime base URL |
| `--name <name>` | `cli` | Key name |

Calls `POST /api/auth/api-keys` with the key name. Prints the raw API key string. Requires prior login.

### `magically build [dir]`

Build a Docker image for a container agent.

| Argument | Default | Description |
|----------|---------|-------------|
| `dir` | `.` (current directory) | Agent directory path |

**Flow:**

1. Reads `manifest.json` from agent directory
2. Requires a `runtime` block (lightweight agents do not need building)
3. Generates a Dockerfile via `generateDockerfile()` from `@magically/shared/dockerfile`
4. Writes temporary `.Dockerfile.magically` in agent directory
5. Runs `docker build -f .Dockerfile.magically -t magically-agent-<id>:<version> <agentDir>`
6. Removes temporary Dockerfile

**Image tag format:** `magically-agent-<agentId>:<version>`

### `magically push [dir]`

Push agent image to container registry.

| Option | Default | Description |
|--------|---------|-------------|
| `--app <app>` (required) | `FLY_AGENTS_APP` env var | Fly app name |

| Argument | Default | Description |
|----------|---------|-------------|
| `dir` | `.` (current directory) | Agent directory path |

**Flow:**

1. Reads manifest (requires `runtime` block)
2. Runs `fly deploy <agentDir> --app <flyApp> --image-label <agentId>-<version> --ha=false --build-only`

**Registry tag format:** `registry.fly.io/<flyApp>:<agentId>-<version>`

### `magically run <agentId> <functionName>`

Run an agent function via the runtime API.

| Option | Default | Description |
|--------|---------|-------------|
| `--base <url>` | `http://localhost:4321` | Runtime base URL |
| `--payload <json>` | `{}` | JSON payload to pass to the function |

**Flow:**

1. Loads stored token (exits if not logged in)
2. Calls `POST /api/agents/<agentId>/run/<functionName>` with JSON body
3. Prints result on success (`OK (<durationMs>ms)` + JSON result)
4. Prints error on failure
5. Prints captured logs if any (level + message)

### `magically publish [dir]`

Publish an agent to the registry.

| Option | Default | Description |
|--------|---------|-------------|
| `--base <url>` | `http://localhost:4321` | Runtime base URL |
| `--validate-only` | false | Only run validation checks, do not publish |

| Argument | Default | Description |
|----------|---------|-------------|
| `dir` | `.` (current directory) | Agent directory path |

**Publish flow:**

```
validate (local) --> bundle (tar.gz) --> upload (POST /api/registry/publish) --> poll status
```

1. **Validate:** Creates a `ValidationPipeline` via `createPublishPipeline()` from `@magically/shared/validation`. Runs all checks at `pre-upload` phase with `shortCircuit: true`. Prints each check result (pass/fail/warn). Exits on failure.
2. **Validate-only mode:** If `--validate-only` is set, stops after validation.
3. **Harness injection:** For container agents (manifest has `runtime` block), writes `_harness.js` to agent directory using `HARNESS_SCRIPT` from `@magically/shared/harness`.
4. **Bundle:** Creates `tar.gz` via `tar czf` in a temp directory. Prints bundle size.
5. **Cleanup:** Removes injected `_harness.js`.
6. **Upload:** Sends multipart form to `POST /api/registry/publish` with `manifest` (JSON string) and `bundle` (blob).
7. **Poll:** If status is `processing`, polls `GET /api/registry/agents/<agentId>/versions/<version>/status` every 5 seconds, up to 120 attempts (10 minutes). Prints final status (`live` + imageRef, or `failed` + error).

### `magically status <agentId>`

Check build status of an agent.

| Option | Default | Description |
|--------|---------|-------------|
| `--base <url>` | `http://localhost:4321` | Runtime base URL |
| `--version <version>` | latest version | Specific version to check |

**Flow:**

1. If no `--version`, fetches latest version via `GET /api/registry/agents/<agentId>`
2. Fetches status via `GET /api/registry/agents/<agentId>/versions/<version>/status`
3. Prints agent ID, version, status, image ref (if available), build error (if any)

### `magically init [dir]`

Scaffold a new Magically agent with AI-ready project structure.

| Option | Default | Description |
|--------|---------|-------------|
| `--name <name>` | interactive prompt | Agent display name |
| `--id <id>` | derived from name | Agent ID |
| `--description <desc>` | interactive prompt / empty | Short description |
| `--container` | false | Include runtime block for container agent |
| `--base <image>` | `node:20-slim` | Base Docker image (requires `--container`) |

| Argument | Default | Description |
|----------|---------|-------------|
| `dir` | agent ID | Target directory |

**Interactive mode:** If `--name` is not provided, prompts for name and description using `enquirer`.

**ID derivation:** `deriveId()` normalizes unicode, strips non-alphanumeric characters, converts to lowercase, replaces spaces with hyphens, collapses multiple hyphens. Falls back to `my-agent` if result is empty.

**ID validation:** Must match `^[a-z0-9-]+$`, max 128 characters, cannot start/end with hyphen.

**Scaffolded directory structure:**

```
<dir>/
  manifest.json
  AGENTS.md
  CLAUDE.md
  .gitignore
  functions/
    hello.js
  docs/
    manifest-reference.md
    function-contract.md
    triggers-and-config.md
    publish-pipeline.md
  .claude/
    settings.json
    skills/
      publish/SKILL.md
      run/SKILL.md
      validate/SKILL.md
      add-function/SKILL.md
      add-trigger/SKILL.md
      status/SKILL.md
```

**Claude Code skills scaffolded:** publish, run, validate, add-function, add-trigger, status. Each skill has a `SKILL.md` file with instructions for Claude Code.

### `magically dev <functionName> [dir]`

*Added 2026-04-04*

Run an agent function locally without Docker, server, or publish pipeline. Reads the manifest, loads the JS function from `functions/`, builds a `ctx` object, and calls the function directly in-process.

| Argument | Default | Description |
|----------|---------|-------------|
| `functionName` (required) | — | Name of the function to run (must be declared in manifest) |
| `dir` | `.` (current directory) | Agent directory path |

| Option | Default | Description |
|--------|---------|-------------|
| `--base <url>` | `http://localhost:4321` | Runtime base URL |
| `--payload <json>` | `{}` | JSON payload passed as function parameters |

**File:** `packages/cli/src/commands/dev.ts`

**Flow:**

1. Reads `manifest.json` from agent directory
2. Validates that the named function exists in the manifest
3. Loads the JS function file from `functions/<functionName>.js`
4. Loads secrets from environment variables (manifest `secrets` array declares which env vars are needed)
5. Builds a `ctx` object with:
   - `ctx.log` — structured logging (info/warn/error)
   - `ctx.secrets` — declared secrets loaded from env
   - `ctx.emit('feed', { type, title, body })` — persists to `POST /api/feed` using stored CLI auth token
   - `ctx.emit('widget', { size, html })` — persists to `POST /api/widgets` (upsert by agentId)
   - `ctx.agentDir` — agent directory path
6. Calls the function with `(ctx, payload)`
7. Prints result or error

**Secrets:** The manifest `secrets` array declares required secret names. `magically dev` loads their values from the current shell environment variables (e.g., if manifest declares `["IG_CT_ACCESS_TOKEN"]`, it reads `process.env.IG_CT_ACCESS_TOKEN`).

**Widget emission:** `ctx.emit('widget', { size: 'small'|'medium'|'large', html: '<div>...</div>' })` sends a `POST /api/widgets` request that upserts the widget for the current agent and user.

**Feed emission:** `ctx.emit('feed', { type, title, body })` sends a `POST /api/feed` request using the stored CLI auth token from `~/.magically/credentials.json`.

### `magically logs` (utility only)

The `logsCommand` object in `commands/logs.ts` exports a `formatLog()` utility for formatting log entries. It is not registered as a CLI command in `index.ts`.

```
formatLog(entry: LogEntry) -> "ISO_TIME [LEVEL] message {data}"
```

## Credential Storage

| Item | Location |
|------|----------|
| Credentials file | `~/.magically/credentials.json` |
| Format | `{ "token": "<jwt_or_api_key>" }` |
| Created by | `login` command |
| Read by | All authenticated commands (`run`, `publish`, `status`, `whoami`, `token`) |
| Deleted by | `logout` command |

The directory `~/.magically/` is created with `{ recursive: true }` if it does not exist.

## How CLI Uses Shared Package

The CLI imports directly from `@magically/shared` subpaths:

| Import | Used by |
|--------|---------|
| `@magically/shared/validation` | `publish` (createPublishPipeline, ValidationContext) |
| `@magically/shared/harness` | `publish` (HARNESS_SCRIPT) |
| `@magically/shared/dockerfile` | `build` (generateDockerfile, RuntimeConfig) |

The CLI does **not** use the shared `ApiClient` class. All HTTP calls use raw `fetch()` with manual `Authorization: Bearer` header injection. Each command loads the token via `authCommand.loadToken()`.

## Known Issues

1. **`init.ts` is 975 lines.** Contains all template functions inline (manifest, AGENTS.md, CLAUDE.md, docs, skills). Should use the shared `scaffoldAgent()` from `@magically/shared/scaffold` instead of duplicating scaffolding logic.
2. **No shared ApiClient usage.** The CLI builds HTTP requests manually with `fetch()` instead of using `@magically/shared/api-client`. This duplicates URL construction, header injection, and error handling.
3. **`logsCommand` is not registered.** The `logs.ts` file exists but `logsCommand` is not mounted as a CLI command in `index.ts`.
4. **Hardcoded callback port.** Browser login always uses port `9876` with no fallback if the port is in use.
5. **`WEB_URL` env var.** Browser login uses `WEB_URL` (default `http://localhost:5173`) to construct the login URL, but this is not documented or configurable via CLI flags.
