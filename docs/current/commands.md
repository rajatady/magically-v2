# CLI Commands Reference

Quick reference for all `magically` CLI commands. For detailed docs, see [cli.md](cli.md).

Last synced: 2026-04-04

## Local Development

| Command | Description |
|---------|-------------|
| `magically dev <fn> [dir]` | Run agent function locally. No Docker, no server, no publish. |
| `magically dev greet agents/hello-world` | Run hello-world's greet function |
| `magically dev fetchInsights agents/instagram-auto-poster` | Run Instagram insights with secrets from env |
| `magically init [dir]` | Scaffold a new agent with manifest, functions, docs, Claude skills |

### `magically dev` options

| Option | Default | Description |
|--------|---------|-------------|
| `--base <url>` | `http://localhost:4321` | Runtime URL for feed/widget persistence |
| `--payload <json>` | `{}` | JSON payload passed to the function |

Secrets are loaded from environment variables. The manifest `secrets` array declares what's needed:

```bash
# Pass secrets inline
IG_CT_ACCESS_TOKEN=xxx magically dev fetchInsights agents/instagram-auto-poster

# Or source from a file
env -i HOME="$HOME" PATH="$PATH" \
  IG_CT_ACCESS_TOKEN="$(grep '^IG_CT_ACCESS_TOKEN=' /path/to/.env | cut -d= -f2-)" \
  magically dev fetchInsights agents/instagram-auto-poster
```

## Authentication

| Command | Description |
|---------|-------------|
| `magically login` | Authenticate via browser OAuth or `--token` |
| `magically logout` | Clear stored credentials |
| `magically whoami` | Show current user |
| `magically token` | Create an API key for automation |

Credentials stored at `~/.magically/credentials.json`.

## Publishing & Registry

| Command | Description |
|---------|-------------|
| `magically publish [dir]` | Validate, bundle, upload to registry, wait for build |
| `magically publish --validate-only` | Run validation checks only |
| `magically status <agentId>` | Check build status of a published agent |
| `magically build [dir]` | Build Docker image locally |
| `magically push [dir]` | Push image to Fly registry |

## Execution

| Command | Description |
|---------|-------------|
| `magically dev <fn> [dir]` | Run locally (preferred for development) |
| `magically run <agentId> <fn>` | Run via runtime API (requires published agent) |

## Quick Start

```bash
# 1. Login
magically login --token "$(curl -s -X POST http://localhost:4321/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"dev@magically.dev","password":"dev12345"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")"

# 2. Scaffold an agent
magically init my-agent --name "My Agent"

# 3. Run it
magically dev hello my-agent

# 4. Run with secrets
API_KEY=xxx magically dev myFunction my-agent
```
