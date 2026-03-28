# Testing Architecture

Last synced: 2026-03-28 | Commit: 97ab426 (development branch)

## Three Test Runners

| Runner | Package | Config | Runs |
|--------|---------|--------|------|
| Jest | `packages/runtime` | `jest` (default) + `test/jest-e2e.json` | Unit + E2E specs |
| Jest | `packages/cli` | `jest.config.ts` (ts-jest, node env) | CLI unit tests |
| Vitest | `apps/web` | `vite.config.ts` (`test` block) | Frontend tests (jsdom) |
| Bun test | Root | Native bun runner | Cross-package (all `*.spec.ts` + `*.test.ts`) |

## Exact Commands

```bash
# Runtime unit tests (parallel)
cd packages/runtime && npx jest

# Runtime e2e tests (sequential, hits DB)
cd packages/runtime && npx jest --config test/jest-e2e.json --runInBand --forceExit

# Web tests
cd apps/web && bunx vitest run

# CLI tests (exclude dist/ to avoid stale compiled specs)
cd packages/cli && npx jest --no-coverage --testPathIgnorePatterns=dist

# Shared typecheck (no tests, just type verification)
cd packages/shared && npx tsc --noEmit

# Runtime typecheck
cd packages/runtime && npx tsc --noEmit

# Full monorepo bun test (catches cross-package issues)
cd <root> && bun test
```

## Runtime Test Configuration

### Unit Tests (Jest default config)

No explicit `jest.config.ts` file found -- uses `package.json` `"test": "jest"` with ts-jest defaults.

Test files: `packages/runtime/src/**/*.spec.ts`

Current unit test files:

| File | Tests |
|------|-------|
| `agents/compute/compute-provider.spec.ts` | Abstract provider contract |
| `agents/compute/docker-provider.spec.ts` | Docker compute (skips if Docker unavailable) |
| `agents/compute/fly-provider.spec.ts` | Fly compute (mocked) |
| `agents/compute/daytona-provider.spec.ts` | Daytona compute (mocked) |
| `agents/types.spec.ts` | Agent type definitions |
| `build/build-provider.spec.ts` | Abstract build provider contract |
| `build/build.service.spec.ts` | Build service provider selection logic |
| `build/docker-build-provider.spec.ts` | Docker build (mocked child_process + fs) |
| `build/fly-build-provider.spec.ts` | Fly build (mocked) |
| `build/github-actions-build-provider.spec.ts` | GitHub Actions build (mocked) |
| `build/build.processor.spec.ts` | BullMQ processor logic |
| `registry/storage.service.spec.ts` | Tigris storage operations |

### E2E / Integration Tests (`test/jest-e2e.json`)

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": ["ts-jest", { "tsconfig": { "module": "commonjs" } }]
  },
  "moduleNameMapper": {
    "^(\\.\\./)+src/(.*)$": "<rootDir>/../src/$2"
  },
  "globalSetup": "<rootDir>/../src/test-global-setup.ts",
  "testEnvironment": "node"
}
```

Test files: `packages/runtime/test/*.spec.ts`

| File | Tests |
|------|-------|
| `agents.service.spec.ts` | Agent CRUD against real DB |
| `auth.service.spec.ts` | Auth service integration |
| `config.service.spec.ts` | Config service integration |
| `database.service.spec.ts` | Database connection |
| `feed.service.spec.ts` | Feed service integration |
| `function-runner.spec.ts` | Function execution integration |
| `registry.service.spec.ts` | Registry publish/install integration |
| `trigger-scheduler.spec.ts` | Cron trigger scheduling |
| `zeus.service.spec.ts` | Zeus AI service integration |
| `zeus.e2e.spec.ts` | Zeus end-to-end flow |

Key: E2E tests import from `../src/` with path remapping via `moduleNameMapper`.

## Test Database Setup (`test-global-setup.ts`)

```typescript
// 1. Read DATABASE_URL from env, fall back to local default
const TEST_DB_URL = process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2_test';

// 2. Parse base URL, connect to 'postgres' admin DB
// 3. CREATE DATABASE if test DB doesn't exist
// 4. Run Drizzle migrations against test DB
```

The global setup:
- Uses `DATABASE_URL` env var (CI provides this with credentials)
- Falls back to `postgres://localhost:5432/magically_v2_test` for local dev
- Connects to `postgres` admin database to create the test DB
- Runs Drizzle migrations from `packages/runtime/drizzle/`
- Only runs for E2E tests (referenced in `jest-e2e.json` `globalSetup`)

## Web Test Configuration (Vitest)

Configured inline in `apps/web/vite.config.ts`:

```typescript
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
  globals: true,
}
```

Test files (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`):

| File | Tests |
|------|-------|
| `lib/store.spec.ts` | Zustand store actions (navigation, feed, zeus messages) |
| `lib/auth.spec.ts` | Auth store actions |
| `lib/socket.test.ts` | Socket connection logic |
| `lib/zeus-blocks.test.ts` | Block tree building, chunk application |
| `components/shell/Sidebar.spec.tsx` | Sidebar rendering |
| `components/home/HomeView.spec.tsx` | HomeView rendering |
| `components/home/HomeView.logic.test.ts` | Home view logic (greeting, filtering) |
| `components/feed/FeedView.logic.test.ts` | Feed view logic (colors, icons) |
| `components/ErrorBoundary.test.tsx` | Error boundary rendering |
| `components/ProtectedRoute.test.tsx` | Auth guard rendering |

## CLI Test Configuration

`packages/cli/jest.config.ts`:

```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
};
```

Run with: `npx jest --no-coverage --testPathIgnorePatterns=dist`

The `--testPathIgnorePatterns=dist` flag prevents running stale compiled JS specs from the build output.

Test files: `packages/cli/src/commands/*.spec.ts`

| File | Tests |
|------|-------|
| `commands/auth.spec.ts` | Auth command (login/logout) |
| `commands/build.spec.ts` | Build command |
| `commands/init.spec.ts` | Init command (scaffold agent) |
| `commands/logs.spec.ts` | Logs command |
| `commands/publish.spec.ts` | Publish command |
| `commands/push.spec.ts` | Push command |
| `commands/run.spec.ts` | Run command |
| `commands/status.spec.ts` | Status command |

## Agent SDK Test Configuration

`packages/agent-sdk` has a single test file:

| File | Tests |
|------|-------|
| `src/bridge.spec.ts` | Agent bridge communication |

Runs in CI as: `bun run test` (in `packages/agent-sdk` working directory).

## Widget DSL Test Configuration

`packages/widget-dsl` has two test files:

| File | Tests |
|------|-------|
| `src/template.spec.ts` | Widget template processing |
| `src/validate.spec.ts` | Widget validation |

Runs in CI as: `bun run test` (in `packages/widget-dsl` working directory).

## Mocking Patterns

### Jest (Runtime + CLI)

**Top-level `jest.mock` -- MANDATORY:**

```typescript
// CORRECT: top-level, Jest hoists this above imports
jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(Buffer.from('')),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

import { execSync } from 'child_process';
```

```typescript
// WRONG: conditional mock breaks hoisting
if (someCondition) {
  jest.mock('child_process');  // Jest hoists this, the `if` is ignored
}
```

**Stub classes for provider tests:**

```typescript
class StubProvider extends BuildProvider {
  constructor(readonly name: string, private available: boolean) { super(); }
  async build(input) { return { imageRef: `${this.name}/${input.agentId}`, durationMs: 50 }; }
  async isAvailable() { return this.available; }
}
```

**ConfigService mocking:**

```typescript
const mockConfig: Partial<ConfigService> = {
  get: jest.fn((key: string) => {
    if (key === 'GHCR_REGISTRY') return 'ghcr.io/rajatady/magically-agents';
    return undefined;
  }),
};
```

### Vitest (Web)

Tests use `vi.mock` for module mocking. Store tests reset state in `beforeEach`:

```typescript
beforeEach(() => {
  useStore.setState({
    view: 'home',
    activeAgentId: null,
    zeusOpen: false,
    agents: [],
    feed: [],
    config: null,
    conversationId: null,
    messages: [],
    zeusTyping: false,
  });
});
```

### Bun Test Compatibility

Bun's native test runner does NOT support `jest.mock` or `vi.mock`. Tests that require module mocking must skip under Bun:

```typescript
const isBun = typeof Bun !== 'undefined';
const maybeDescribe = isBun ? describe.skip : describe;

maybeDescribe('tests that need mocking', () => {
  // ...
});
```

### Docker-Dependent Tests

Tests that require a running Docker daemon use conditional `describe`:

```typescript
let dockerAvailable = false;
try {
  execSync('docker info', { stdio: 'ignore' });
  dockerAvailable = true;
} catch {}

const describeDocker = dockerAvailable ? describe : describe.skip;

describeDocker('DockerProvider', () => {
  // actual Docker tests (run alpine containers, etc.)
});
```

## Node 22 ESM Compatibility

Node 22 makes ESM namespace properties non-configurable. This breaks `jest.spyOn` on Node builtin modules.

```typescript
// BROKEN on Node 22:
jest.spyOn(childProcess, 'execSync');

// CORRECT: use top-level jest.mock
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));
```

This applies to all Node builtins: `child_process`, `fs`, `path`, `os`, etc.

## CI Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs:

1. Build shared (`bun run build` in `packages/shared`)
2. Run migrations (`bun run db:migrate` in `packages/runtime`)
3. `bun run test` -- runtime unit tests via Jest
4. `bun run test:e2e` -- runtime integration tests via Jest (`--runInBand --forceExit`)
5. `bun run test` -- CLI tests via Jest
6. `bun run test` -- agent-sdk tests
7. `bun run test` -- widget-dsl tests
8. `bun run test` -- web tests via Vitest

E2E tests use `DATABASE_URL` env var in CI for Postgres credentials. Tests run sequentially (`--runInBand`) because they share a single test database.

## Verification Checklist (Pre-Commit)

All of these must pass before committing:

```bash
# 1. Typecheck runtime
cd packages/runtime && npx tsc --noEmit

# 2. Runtime unit tests
npx jest

# 3. Runtime e2e tests
npx jest --config test/jest-e2e.json --runInBand --forceExit

# 4. Web tests
cd ../../apps/web && bunx vitest run

# 5. CLI tests
cd ../../packages/cli && npx jest --no-coverage --testPathIgnorePatterns=dist

# 6. Shared typecheck
cd ../../packages/shared && npx tsc --noEmit

# 7. Full monorepo bun test
cd ../.. && bun test
```

## Known Issues

1. **No explicit jest.config for runtime unit tests.** Runtime unit tests rely on ts-jest defaults. The E2E config is explicit in `test/jest-e2e.json` but unit test config is inferred.

2. **Docker-dependent compute tests skip in CI.** `docker-provider.spec.ts` conditionally skips if Docker is not available. These tests only run locally with Docker running.

3. **E2E tests share a single DB.** All integration tests run against `magically_v2_test`. No per-test isolation -- tests must clean up after themselves or risk state leakage.

4. **Bun test runs all specs.** The root `bun test` discovers every `*.spec.ts` and `*.test.ts` across the monorepo, including tests designed for Jest or Vitest. Tests that need module mocking must explicitly skip under Bun.

5. **globalSetup only for E2E.** Unit tests do not run `test-global-setup.ts`. If a unit test accidentally imports something that touches the DB, it will fail.
