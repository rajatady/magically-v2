# Deployment

Last synced: 2026-04-04 | Commit: 93e7bdc (development branch)

## Overview

| Component | Target | Trigger |
|-----------|--------|---------|
| Runtime (NestJS API) | Fly.io | CI success on `main` |
| Web (Vite + React) | Vercel | CI success on `main` |
| Agent images | GHCR + Fly registry | Publish pipeline (GitHub Actions builder) |
| Database | Neon PostgreSQL | Drizzle migrations (release command) |

## CI Pipeline

**File:** `.github/workflows/ci.yml`

**Triggers:** Push to `main`, pull requests targeting `main`.

**Services:** PostgreSQL 17 container (`magically`/`magically`/`magically_test` on port 5432).

**Environment:** `DATABASE_URL=postgres://magically:magically@localhost:5432/magically_test`

**Steps (sequential):**

| Step | Working Directory | Command |
|------|-------------------|---------|
| Checkout | repo root | `actions/checkout@v4` |
| Setup bun | repo root | `oven-sh/setup-bun@v2` (bun 1.2.3) |
| Install | repo root | `bun install --frozen-lockfile` |
| Build shared | `packages/shared` | `bun run build` |
| Run migrations | `packages/runtime` | `bun run db:migrate` |
| Test runtime (unit) | `packages/runtime` | `bun run test` |
| Test runtime (e2e) | `packages/runtime` | `bun run test:e2e` |
| Test CLI | `packages/cli` | `bun run test` |
| Test agent-sdk | `packages/agent-sdk` | `bun run test` |
| Test widget-dsl | `packages/widget-dsl` | `bun run test` |
| Test web | `apps/web` | `bun run test` |

**Key detail:** Shared is built first because all other packages import from `@magically/shared` subpaths which resolve to `dist/`.

## Runtime Deployment (Fly.io)

### Dockerfile

**File:** `Dockerfile` (repo root)

**Multi-stage build:**

```
Stage 1: builder (node:22-slim)
  - Install bun 1.2.3
  - Copy package.json files for shared, runtime, agent-sdk, widget-dsl
  - bun install
  - Copy source for shared, runtime, agent-sdk, widget-dsl
  - Build shared (tsc -b)
  - Build runtime (nest build)

Stage 2: production (node:22-slim)
  - Install bun 1.2.3
  - Copy package.json files
  - bun install --production
  - Copy built artifacts:
    - packages/shared/dist
    - packages/runtime/dist
    - packages/runtime/drizzle (migration files)
    - agents/ (example agents)
  - EXPOSE 4321
  - CMD ["node", "packages/runtime/dist/main.js"]
```

**Environment variables set in Dockerfile:**

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4321` |

### fly.toml

**File:** `fly.toml`

```toml
app = "magically-runtime"
primary_region = "bom"

[deploy]
  release_command = "node packages/runtime/dist/migrate.js"

[env]
  PORT = "4321"
  NODE_ENV = "production"

[http_service]
  internal_port = 4321
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

**Release command:** Runs `node packages/runtime/dist/migrate.js` before each deploy. This script:

1. Reads `DATABASE_URL` from environment
2. Creates a `pg` Pool connection
3. Runs Drizzle migrations from `packages/runtime/drizzle/` folder
4. Exits

### Deploy Workflow

**File:** `.github/workflows/deploy-runtime.yml`

**Trigger:** Runs after the CI workflow completes successfully on `main` (`workflow_run` event).

**Steps:**

1. Checkout code
2. Setup flyctl (`superfly/flyctl-actions/setup-flyctl@master`)
3. Run `flyctl deploy --ha=false`

**GitHub Secrets required:**

| Secret | Purpose |
|--------|---------|
| `FLY_API_TOKEN` | Fly.io API authentication |

## Web Deployment (Vercel)

### vercel.json

**File:** `apps/web/vercel.json`

```json
{
  "installCommand": "cd ../.. && bun install",
  "buildCommand": "cd ../../packages/shared && bun run build && cd ../../apps/web && bun run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Key detail:** `buildCommand` builds shared first (`tsc -b`), then builds the web app (`vite build`). The install command runs from the monorepo root to resolve workspace dependencies.

**SPA routing:** All routes rewrite to `/index.html`.

### Deploy Workflow

**File:** `.github/workflows/deploy-web.yml`

**Trigger:** Runs after the CI workflow completes successfully on `main` (`workflow_run` event).

**Steps:**

1. Checkout code
2. Deploy via `amondnet/vercel-action@v25` with `--prod` flag

**GitHub Secrets required:**

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Vercel API authentication |
| `VERCEL_ORG_ID` | Vercel organization identifier |
| `VERCEL_PROJECT_ID` | Vercel project identifier |

## Production Database (Neon PostgreSQL)

| Item | Detail |
|------|--------|
| Provider | Neon (serverless PostgreSQL) |
| ORM | Drizzle ORM (`drizzle-orm/node-postgres`) |
| Migration runner | `packages/runtime/src/migrate.ts` |
| Migration files | `packages/runtime/drizzle/` |
| Migration tracking | `__drizzle_migrations` table |
| Connection | `DATABASE_URL` environment variable |
| Test DB | `magically_test` (separate from dev) |

**Migration flow:**

```
flyctl deploy --> release_command --> node packages/runtime/dist/migrate.js
                                        --> reads DATABASE_URL
                                        --> drizzle migrate(db, { migrationsFolder: 'drizzle/' })
```

**Known issue:** If a migration fails with "already exists", the Drizzle journal (`__drizzle_migrations`) is out of sync with the actual schema. Fix by either wiping the database or manually inserting journal entries.

## Agent Image Builds

Container agents (those with a `runtime` block in their manifest) go through a build pipeline after publish:

### Build Providers

The runtime selects a build provider based on the `BUILD_PROVIDER` environment variable:

| Value | Provider | Used When |
|-------|----------|-----------|
| `github-actions` | `GitHubActionsBuildProvider` | Production |
| `docker` | `DockerBuildProvider` | Local development |
| `fly` | `FlyBuildProvider` | Alternative (Fly remote builder) |
| `auto` (default) | First available provider | Fallback |

### GitHub Actions Build Flow (Production)

1. Runtime dispatches a `workflow_dispatch` event to the builder repo (`GITHUB_BUILDER_REPO`)
2. Builder workflow downloads the agent bundle from Tigris (S3-compatible storage)
3. Builds Docker image from the generated Dockerfile
4. Pushes image to GHCR (`ghcr.io/rajatady/magically-agents`)
5. Also pushes to Fly registry (`registry.fly.io/<FLY_AGENTS_APP>`) for Fly Machines

### Compute Providers

The runtime selects a compute provider based on the `COMPUTE_PROVIDER` environment variable:

| Value | Provider | Requirements |
|-------|----------|--------------|
| `fly` | `FlyProvider` | `FLY_API_TOKEN`, `FLY_AGENTS_APP` |
| `docker` | `DockerProvider` | Docker daemon available |
| `daytona` | `DaytonaProvider` | `DAYTONA_API_KEY` |
| `auto` (default) | First available provider | Fallback |

## Environment Variables

### Runtime (Fly.io)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | yes | none | PostgreSQL connection string |
| `JWT_SECRET` | yes | none | JWT signing secret |
| `GOOGLE_CLIENT_ID` | yes | none | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | yes | none | Google OAuth client secret |
| `PORT` | no | `4321` | HTTP server port |
| `NODE_ENV` | no | `production` (in Dockerfile) | Node environment |
| `COMPUTE_PROVIDER` | no | `auto` | Compute provider selection |
| `BUILD_PROVIDER` | no | `auto` | Build provider selection |
| `FLY_API_TOKEN` | for Fly compute/build | none | Fly.io API token |
| `FLY_AGENTS_APP` | for Fly compute/build | none | Fly app for agent machines |
| `GHCR_REGISTRY` | no | `ghcr.io/rajatady/magically-agents` | GHCR image registry prefix |
| `GITHUB_BUILDER_REPO` | for GH Actions build | none | Builder repository (owner/repo) |
| `GITHUB_BUILDER_TOKEN` | for GH Actions build | none | PAT for dispatching builder workflow |
| `AWS_REGION` | for Tigris storage | `auto` | S3 region |
| `AWS_ENDPOINT_URL_S3` | for Tigris storage | none | Tigris endpoint URL |
| `AWS_ACCESS_KEY_ID` | for Tigris storage | none | Tigris access key |
| `AWS_SECRET_ACCESS_KEY` | for Tigris storage | none | Tigris secret key |
| `RUNTIME_URL` | for OAuth | `http://localhost:4321` | Runtime base URL for OAuth callbacks |
| `WEB_URL` | for CORS/OAuth | `http://localhost:5173` | Web app URL for CORS and OAuth redirects |
| `REDIS_URL` | for builds | `redis://localhost:6379` | Redis URL for BullMQ |
| `ANTHROPIC_API_KEY` | for Zeus | none | Claude API key (read by Agent SDK from env) |
| `OPENROUTER_API_KEY` | no | none | OpenRouter API key for LLM |
| `DAYTONA_API_KEY` | for Daytona compute | none | Daytona API key |
| `DAYTONA_API_URL` | no | `https://app.daytona.io/api` | Daytona API endpoint |
| `DAYTONA_TARGET` | no | none | Daytona target identifier |

### CI (GitHub Actions)

| Secret | Used By |
|--------|---------|
| `FLY_API_TOKEN` | deploy-runtime workflow |
| `VERCEL_TOKEN` | deploy-web workflow |
| `VERCEL_ORG_ID` | deploy-web workflow |
| `VERCEL_PROJECT_ID` | deploy-web workflow |

### Web (Vercel)

The web app is a static SPA. It connects to the runtime API at a configured base URL. Environment variables are handled by Vite at build time (not documented in the codebase config files).

## nest-cli.json

**File:** `packages/runtime/nest-cli.json`

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

Uses `@nestjs/schematics` with `deleteOutDir: true` (cleans `dist/` before each build).

## Desktop App (Electron)

*Added 2026-04-04*

### Package

| Field | Value |
|-------|-------|
| Name | `@magically/desktop` |
| Location | `apps/desktop/` |
| Entry | `src/main.js` |
| Framework | Electron 33 |
| Packager | electron-builder |

### Architecture

The desktop app is an Electron shell wrapping the bundled React SPA. The NestJS backend starts as a child process (or reuses an existing one if port 4321 is already in use).

### Window Configuration

```javascript
{
  titleBarStyle: 'hidden',              // Custom title bar
  trafficLightPosition: { x: 12, y: 12 },  // macOS traffic lights position
  backgroundColor: '#0a0a0b',           // Matches app background
  webPreferences: {
    webSecurity: false,                 // Allow file:// to fetch from localhost API
    partition: 'persist:magically',     // Persistent localStorage across launches
  }
}
```

**Note:** Uses `titleBarStyle: 'hidden'` with explicit `trafficLightPosition`, NOT `hiddenInset` (which causes focus bugs on macOS).

### Backend Process Management

1. On app ready, checks if port 4321 is already in use
2. If already running: skips backend startup, uses existing server
3. If not running: spawns `bun run start:dev` in `packages/runtime/` as a child process
4. Waits up to 30s for the port to become available (`waitForPort()` with TCP socket check)
5. On `before-quit`: kills the child process

### System Tray

Creates a menu bar tray icon with "Open Magically" and "Quit" options. Closing the window hides it to the tray instead of quitting (macOS pattern).

### Router Adaptation

The web app uses `HashRouter` when running in Electron (detected via `navigator.userAgent.includes('Electron')`) because `file://` protocol does not support HTML5 pushState routing. See [frontend.md](frontend.md).

### Build & Run Commands

```bash
# Full build + launch (builds web, copies to desktop, starts Electron)
bun run desktop

# Quick launch with existing web build
bun run desktop:dev
```

The `web-dist/` directory contains the bundled React app copied from `apps/web/dist/`.

---

## Known Issues

1. **Single VM, no HA.** Both `fly.toml` and deploy command use `--ha=false` and `min_machines_running = 1`. No horizontal scaling.
2. **VM size.** `shared-cpu-1x` with 512MB memory. Suitable for early development only.
3. **Migration journal sync.** Drizzle migration failures with "already exists" errors require manual intervention (wipe DB or edit `__drizzle_migrations` table).
4. **Docker info timeout.** `DockerProvider.isAvailable()` has a 5-second timeout on `execSync('docker info')`. Without this, CI hangs when Docker is not installed.
5. **No web environment variable documentation.** The web app's required environment variables (API base URL, etc.) are not documented in `vercel.json` or any config file.
6. **Deploy workflows depend on CI.** Both deploy workflows use `workflow_run` trigger, meaning they only fire after CI completes on `main`. There is no manual deploy trigger.
