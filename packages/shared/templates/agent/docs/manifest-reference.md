# Manifest Reference

The `manifest.json` file declares everything about your agent: identity, functions, triggers, runtime, secrets, and config.

## Required Fields

### `id` (string)
Unique identifier. Lowercase alphanumeric and hyphens only: `^[a-z0-9-]+$`.

```json
"id": "my-agent"
```

### `name` (string)
Human-readable display name.

```json
"name": "My Agent"
```

### `version` (string)
Semantic version. Bumped on each publish.

```json
"version": "1.0.0"
```

### `functions` (array)
Array of callable functions. Each function has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Function identifier (matches filename in `functions/`) |
| `description` | string | yes | What this function does |
| `parameters` | object | no | JSON Schema for input parameters |
| `run` | string | no | Execution command (required for container agents) |

```json
"functions": [
  {
    "name": "greet",
    "description": "Greet the user",
    "parameters": {
      "type": "object",
      "properties": { "name": { "type": "string" } }
    },
    "run": "node functions/greet.js"
  }
]
```

## Optional Fields

### `description` (string)
Short description of what the agent does.

### `icon` (string)
Emoji or icon identifier for the agent.

### `author` (string)
Creator name.

### `category` (string)
Agent category for discovery (e.g., "social", "productivity", "developer-tools").

### `color` (string)
Hex color for UI theming (e.g., "#E1306C").

### `tags` (string[])
Tags for search and discovery.

### `secrets` (string[])
Environment variable names the agent needs. Only declared secrets are injected at runtime.

```json
"secrets": ["API_KEY", "WEBHOOK_URL"]
```

### `config` (object)
User-configurable fields with schema:

```json
"config": {
  "frequency": {
    "type": "number",
    "label": "Check frequency (hours)",
    "default": 4,
    "required": false
  },
  "targetUrl": {
    "type": "string",
    "label": "URL to monitor",
    "required": true
  }
}
```

Supported types: `string`, `number`, `boolean`, `array`, `text` (multiline string).

### `runtime` (object)
Container configuration. **Omit this entirely for lightweight (in-process) agents.**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `base` | string | yes | Docker base image (e.g., `node:20-slim`, `python:3.12-slim`) |
| `system` | string[] | no | System packages to install via apt-get |
| `install` | string | no | Install command (e.g., `pip install requests`) |

```json
"runtime": {
  "base": "python:3.12-slim",
  "system": ["chromium", "fonts-noto"],
  "install": "pip install playwright && playwright install chromium --with-deps"
}
```

### `triggers` (array)
Triggers that auto-invoke functions on a schedule or event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Trigger type: `cron`, `event`, `webhook` |
| `name` | string | yes | Display name |
| `entrypoint` | string | yes | Function name to call |
| `schedule` | string | no | Cron expression (for `cron` type) |

```json
"triggers": [
  {
    "type": "cron",
    "name": "Hourly Check",
    "entrypoint": "check",
    "schedule": "0 * * * *"
  }
]
```

### `ui` (object)
React UI entry point for agents with a visual interface.

```json
"ui": {
  "entry": "ui/App.tsx",
  "widget": "widget.json"
}
```

### `permissions` (object)
Permissions the agent requires.

```json
"permissions": {
  "data": [],
  "actions": [],
  "memory": "none"
}
```

## Minimum Valid Manifest

```json
{
  "id": "my-agent",
  "name": "My Agent",
  "version": "1.0.0",
  "functions": []
}
```
