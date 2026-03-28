# Triggers, Secrets & Config

## Triggers

Triggers auto-invoke functions on a schedule or in response to events.

### Cron Triggers

Run a function on a schedule using cron expressions:

```json
{
  "type": "cron",
  "name": "Hourly Check",
  "entrypoint": "check",
  "schedule": "0 * * * *"
}
```

The `entrypoint` must match a function name in the `functions` array.

### Cron Expression Reference

| Expression | Meaning |
|-----------|---------|
| `* * * * *` | Every minute |
| `0 * * * *` | Every hour |
| `0 9 * * *` | Daily at 9am UTC |
| `0 9 * * 1-5` | Weekdays at 9am UTC |
| `0 */4 * * *` | Every 4 hours |
| `0 0 1 * *` | First of every month |

### Event Triggers (Planned)

React to events from other agents:

```json
{
  "type": "event",
  "name": "On New Post",
  "entrypoint": "handleNewPost",
  "event": "feed.new"
}
```

### Webhook Triggers (Planned)

Receive HTTP requests from external services:

```json
{
  "type": "webhook",
  "name": "GitHub Push",
  "entrypoint": "onPush"
}
```

## Secrets

Secrets are sensitive values (API keys, tokens) that your agent needs.

### Declaring Secrets

In `manifest.json`:
```json
"secrets": ["API_KEY", "WEBHOOK_URL"]
```

### Setting Secrets

```bash
magically secrets set <agentId> API_KEY=sk-123456
```

### Accessing Secrets

In your function:
```javascript
module.exports = async function myFn(ctx) {
  const apiKey = ctx.secrets.API_KEY;
};
```

In containers, secrets are injected as environment variables.

### Security

- Only secrets declared in the manifest are injected
- Never hardcode secrets in source files — the validation pipeline scans for them
- Secrets are stored in the platform database (encryption at rest planned)

## Config

Config fields are user-configurable values set at install time.

### Declaring Config

In `manifest.json`:
```json
"config": {
  "frequency": {
    "type": "number",
    "label": "Check frequency (hours)",
    "default": 4,
    "required": false
  }
}
```

### Supported Types

| Type | Description |
|------|-------------|
| `string` | Single-line text |
| `number` | Numeric value |
| `boolean` | True/false toggle |
| `array` | List of values |
| `text` | Multi-line text |

### Accessing Config

```javascript
module.exports = async function myFn(ctx) {
  const freq = ctx.config.frequency;
};
```
