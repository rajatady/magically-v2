# Publish Pipeline

## Overview

Publishing an agent makes it available to run on the Magically platform. The process varies depending on whether your agent is lightweight or containerized.

## Steps

### 1. Local Validation

`magically publish .` first runs the validation pipeline:

1. **manifest-exists** — checks `manifest.json` exists and is valid JSON
2. **manifest-schema** — validates against the Zod schema
3. **functions-exist** — verifies all declared function files exist
4. **functions-executable** — checks JS functions use `module.exports`
5. **no-hardcoded-secrets** — scans for leaked API keys

If any check fails with severity `error`, publishing stops.

Use `magically publish . --validate-only` to run checks without publishing.

### 2. Bundle

The CLI creates a `tar.gz` archive of the agent directory, injecting `_harness.js` for container agents.

### 3. Upload

The bundle is uploaded to Tigris (S3-compatible storage) via the runtime API.

### 4. Build (Container Agents Only)

If the agent has a `runtime` block:

1. A BullMQ job is enqueued
2. A GitHub Actions workflow downloads the bundle from Tigris
3. A Docker image is built from the generated Dockerfile
4. The image is pushed to GHCR (primary) and Fly registry (for Fly Machines)

### 5. Status

Track build progress:

```bash
magically status <agentId>
```

Status lifecycle: `processing` → `building` → `live` | `failed`

## Running

Once published (status = `live`):

```bash
magically run <agentId> <functionName>
magically run <agentId> <functionName> --payload '{"key": "value"}'
```

The runtime selects a compute provider (Fly Machines in production, Docker locally) and runs the function.
