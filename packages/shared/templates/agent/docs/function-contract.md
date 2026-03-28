# Function Contract

## The Pattern

Every function is a JavaScript file in `functions/` that exports an async function:

```javascript
module.exports = async function myFunction(ctx, params) {
  // Your logic here
  return { result: 'value' };
};
```

## The `ctx` Object

The runtime injects a context object with these capabilities:

| Property | Type | Description |
|----------|------|-------------|
| `ctx.log.info(msg, data?)` | function | Log at info level |
| `ctx.log.warn(msg, data?)` | function | Log at warn level |
| `ctx.log.error(msg, data?)` | function | Log at error level |
| `ctx.secrets` | object | Key-value map of declared secrets |
| `ctx.config` | object | User-configured values |
| `ctx.emit(event, data)` | function | Emit events (e.g., feed updates) |
| `ctx.llm.ask(question)` | function | Ask the platform LLM a question |
| `ctx.agentDir` | string | Path to the agent directory |

## Container Execution

When an agent has a `runtime` block in its manifest, functions run inside Docker containers.

### How It Works

1. At publish time, `_harness.js` is injected into the agent bundle
2. The container runs `node _harness.js`
3. The harness reads `MAGICALLY_FUNCTION` environment variable
4. It `require()`s `functions/<name>.js` and calls the exported function
5. The function receives `ctx` constructed from environment variables

### Environment Variables in Containers

| Variable | Description |
|----------|-------------|
| `MAGICALLY_AGENT_ID` | The agent's ID |
| `MAGICALLY_FUNCTION` | Which function to run |
| `MAGICALLY_TRIGGER` | JSON with trigger info (type, source, payload) |
| Plus all declared secrets | Each secret as its own env var |

### Non-JavaScript Functions

For Python, Go, Rust, etc., functions don't use the harness. They:

1. Read environment variables directly
2. Execute their logic
3. Print JSON to stdout (captured as the run result)

Example `run` command: `"run": "python scripts/analyze.py"`

The Python script reads `os.environ['MAGICALLY_FUNCTION']`, `os.environ['MY_SECRET']`, etc.

## Return Values

- The return value of your function is stored as the run result
- For container agents, JSON printed to stdout is captured
- Errors thrown are caught and stored as run errors
- All `ctx.log` calls are captured in the run logs

## Best Practices

1. Always use `ctx.log` instead of `console.log` — logs are captured and stored
2. Declare all secrets in the manifest — undeclared secrets won't be injected
3. Keep functions focused — one function, one responsibility
4. Return structured data — makes results queryable
5. Use `ctx.emit('feed', ...)` for user-visible updates
