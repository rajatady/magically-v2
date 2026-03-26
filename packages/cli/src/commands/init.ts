import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, basename } from 'path';

export interface InitOptions {
  name?: string;
  id?: string;
  description?: string;
  container?: boolean;
  base?: string;
}

/** Regex for valid agent IDs — matches manifest-schema validation */
const VALID_ID = /^[a-z0-9-]+$/;

export const initCommand = {
  /**
   * Derive a valid agent ID from any user input.
   * Handles unicode, special chars, emojis, whitespace — never crashes, never returns empty.
   */
  deriveId(input: string): string {
    const id = input
      .normalize('NFKD')                    // decompose unicode (e.g. é → e + combining accent)
      .replace(/[\u0300-\u036f]/g, '')       // strip combining diacritical marks
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')          // strip anything not alphanumeric, space, or hyphen
      .trim()
      .replace(/\s+/g, '-')                  // spaces → hyphens
      .replace(/-+/g, '-')                   // collapse multiple hyphens
      .replace(/^-|-$/g, '');                // strip leading/trailing hyphens

    if (id.length === 0) return 'my-agent';
    return id;
  },

  /**
   * Validate that an ID matches the manifest schema requirement.
   * Returns null if valid, error message if invalid.
   */
  validateId(id: string): string | null {
    if (id.length === 0) return 'Agent ID cannot be empty';
    if (id.length > 128) return 'Agent ID must be 128 characters or fewer';
    if (!VALID_ID.test(id)) return 'Agent ID must be lowercase alphanumeric and hyphens only (a-z, 0-9, -)';
    if (id.startsWith('-') || id.endsWith('-')) return 'Agent ID cannot start or end with a hyphen';
    return null;
  },

  /**
   * Sanitize a function name to be a valid JS identifier and filename.
   * Returns a safe camelCase name, never empty.
   */
  sanitizeFunctionName(input: string): string {
    const cleaned = input
      .replace(/[^a-zA-Z0-9_\s-]/g, '')
      .trim();

    if (cleaned.length === 0) return 'myFunction';

    // Convert to camelCase: "my function name" → "myFunctionName"
    const parts = cleaned.split(/[\s-]+/).filter(Boolean);
    if (parts.length === 0) return 'myFunction';

    return parts
      .map((p, i) => i === 0 ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join('');
  },

  async exec(targetDir: string | undefined, opts: InitOptions): Promise<void> {
    // Resolve options — prompt if not provided
    let name = opts.name;
    let description = opts.description ?? '';
    let id = opts.id;

    if (!name) {
      const { default: enquirer } = await import('enquirer');
      const answers = await (enquirer as any).prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Agent name:',
          validate: (v: string) => {
            if (v.trim().length === 0) return 'Name is required';
            const derived = initCommand.deriveId(v);
            if (derived === 'my-agent' && !v.toLowerCase().includes('my agent')) {
              return 'Name must contain at least one alphanumeric character';
            }
            return true;
          },
        },
        { type: 'input', name: 'description', message: 'Description (optional):' },
      ]);
      name = (answers as any).name;
      description = (answers as any).description || '';
    }

    if (!id) {
      id = this.deriveId(name!);
    }

    // Validate the ID
    const idError = this.validateId(id!);
    if (idError) {
      throw new Error(`Invalid agent ID "${id}": ${idError}`);
    }

    // Directory name = agent ID (unless explicitly provided)
    const dir = targetDir ?? id!;

    // Guard: don't overwrite existing projects
    if (existsSync(dir)) {
      const entries = readdirSync(dir);
      if (entries.length > 0) {
        throw new Error(`Directory already exists and is not empty: ${dir}`);
      }
    }

    const isContainer = opts.container ?? false;
    const baseImage = opts.base ?? 'node:20-slim';

    // Create directory structure
    mkdirSync(join(dir, 'functions'), { recursive: true });
    mkdirSync(join(dir, 'docs'), { recursive: true });
    mkdirSync(join(dir, '.claude', 'skills', 'publish'), { recursive: true });
    mkdirSync(join(dir, '.claude', 'skills', 'run'), { recursive: true });
    mkdirSync(join(dir, '.claude', 'skills', 'validate'), { recursive: true });
    mkdirSync(join(dir, '.claude', 'skills', 'add-function'), { recursive: true });
    mkdirSync(join(dir, '.claude', 'skills', 'add-trigger'), { recursive: true });
    mkdirSync(join(dir, '.claude', 'skills', 'status'), { recursive: true });

    // Write all files
    writeFileSync(join(dir, 'manifest.json'), manifestTemplate(id!, name!, description, isContainer, baseImage));
    writeFileSync(join(dir, 'AGENTS.md'), agentsMdTemplate(id!, name!, description));
    writeFileSync(join(dir, 'CLAUDE.md'), claudeMdTemplate());
    writeFileSync(join(dir, '.gitignore'), gitignoreTemplate());
    writeFileSync(join(dir, '.claude', 'settings.json'), settingsTemplate());
    writeFileSync(join(dir, 'functions', 'hello.js'), helloFunctionTemplate(name!, isContainer));

    // Docs
    writeFileSync(join(dir, 'docs', 'manifest-reference.md'), manifestReferenceMd());
    writeFileSync(join(dir, 'docs', 'function-contract.md'), functionContractMd());
    writeFileSync(join(dir, 'docs', 'triggers-and-config.md'), triggersAndConfigMd());
    writeFileSync(join(dir, 'docs', 'publish-pipeline.md'), publishPipelineMd());

    // Skills
    writeFileSync(join(dir, '.claude', 'skills', 'publish', 'SKILL.md'), skillPublish());
    writeFileSync(join(dir, '.claude', 'skills', 'run', 'SKILL.md'), skillRun());
    writeFileSync(join(dir, '.claude', 'skills', 'validate', 'SKILL.md'), skillValidate());
    writeFileSync(join(dir, '.claude', 'skills', 'add-function', 'SKILL.md'), skillAddFunction());
    writeFileSync(join(dir, '.claude', 'skills', 'add-trigger', 'SKILL.md'), skillAddTrigger());
    writeFileSync(join(dir, '.claude', 'skills', 'status', 'SKILL.md'), skillStatus());

    // Success message
    const dirName = basename(dir);
    console.log(`\n  Agent scaffolded: ${dirName}/\n`);
    console.log(`  cd ${dirName}`);
    console.log(`  magically publish .          # publish to registry`);
    console.log(`  magically run ${id} hello    # run the hello function`);
    console.log(`\n  Open in Claude Code for AI-assisted development with /publish, /run, /add-function skills.\n`);
  },
};

// ─── Templates ──────────────────────────────────────────────────────────────────

function manifestTemplate(id: string, name: string, description: string, isContainer: boolean, base: string): string {
  const manifest: Record<string, unknown> = {
    id,
    name,
    version: '1.0.0',
    description: description || `${name} agent`,
    icon: '🤖',
    author: '',
    functions: [
      {
        name: 'hello',
        description: 'A greeting function to verify the agent works',
        parameters: {},
      },
    ],
    triggers: [],
    secrets: [],
  };

  if (isContainer) {
    manifest.runtime = {
      base,
      system: [],
      install: '',
    };
    // Container functions need a run command
    (manifest.functions as any[])[0].run = 'node functions/hello.js';
  }

  return JSON.stringify(manifest, null, 2) + '\n';
}

function claudeMdTemplate(): string {
  return `@AGENTS.md
`;
}

function agentsMdTemplate(id: string, name: string, description: string): string {
  return `# ${name} — Agent Development Guide

${description || `${name} is a Magically agent.`}

## Quick Reference

- **Agent ID:** \`${id}\`
- **Manifest:** \`manifest.json\` — declares identity, functions, triggers, secrets, runtime
- **Functions:** \`functions/\` — each function is a JS file with \`module.exports = async function(ctx) { ... }\`
- **Publish:** \`magically publish .\` (or use /publish skill)
- **Run:** \`magically run ${id} <functionName>\` (or use /run skill)
- **Validate:** \`magically publish . --validate-only\` (or use /validate skill)

## Function Contract

Every function file in \`functions/\` must export an async function:

\`\`\`javascript
module.exports = async function myFunction(ctx, params) {
  // ctx.log.info(message, data)    — structured logging
  // ctx.secrets.MY_SECRET          — secrets declared in manifest
  // ctx.emit('feed', { type, title, body }) — emit UI events
  // await ctx.llm.ask(question)    — ask the LLM
  // ctx.agentDir                   — agent directory path

  return { result: 'value' };  // returned as run result
};
\`\`\`

The \`ctx\` object is injected by the runtime. In containers, \`_harness.js\` reads \`MAGICALLY_FUNCTION\` env and calls the matching export.

## Manifest Schema

See @docs/manifest-reference.md for the full schema. Key fields:

| Field | Required | Description |
|-------|----------|-------------|
| \`id\` | yes | Lowercase alphanumeric + hyphens only (\`^[a-z0-9-]+$\`) |
| \`name\` | yes | Display name |
| \`version\` | yes | Semver string |
| \`functions\` | yes | Array of function declarations (name, description, parameters, run) |
| \`runtime\` | no | Container config (base image, system deps, install command). Omit for lightweight agents |
| \`triggers\` | no | Array of triggers (cron, event, webhook) |
| \`secrets\` | no | Array of secret names the agent needs |
| \`config\` | no | User-configurable fields with schema |

## Agent Types

**Lightweight (no \`runtime\` block):** Runs in-process in Node.js. No Docker. Fast, simple.

**Container (has \`runtime\` block):** Runs in Docker. Can use any language (Python, Rust, Go). Needs a \`run\` command on each function. The \`_harness.js\` bridges JS functions; non-JS functions read env vars and print JSON to stdout.

## Validation Rules

Before publishing, these checks run automatically:

1. **manifest-exists** — \`manifest.json\` must exist and be valid JSON
2. **manifest-schema** — must match the required schema (id, name, version, functions)
3. **functions-exist** — every function's file must exist (e.g., \`functions/hello.js\`)
4. **functions-executable** — JS functions must use \`module.exports\` pattern
5. **no-hardcoded-secrets** — scans for leaked API keys, tokens, passwords

## Secrets & Config

See @docs/triggers-and-config.md for details.

- **Secrets:** Declare in manifest \`"secrets": ["MY_KEY"]\`. Access via \`ctx.secrets.MY_KEY\`. Set via \`magically secrets set ${id} MY_KEY=value\`.
- **Config:** Declare schema in manifest \`"config": { "field": { "type": "string", "label": "...", "default": "..." } }\`. User-configurable at install time.

## Publish Pipeline

See @docs/publish-pipeline.md for the full flow.

1. CLI validates locally (all 5 checks)
2. Bundles agent directory into tar.gz
3. Uploads to Tigris (S3-compatible storage)
4. If container agent: enqueues build job → GitHub Actions builds Docker image → pushes to GHCR + Fly registry
5. Status: \`processing\` → \`building\` → \`live\` | \`failed\`
6. Poll with \`magically status ${id}\`

## Development Workflow

1. Edit functions in \`functions/\`
2. Update \`manifest.json\` if adding new functions/triggers/secrets
3. \`magically publish . --validate-only\` to check before publishing
4. \`magically publish .\` to publish
5. \`magically run ${id} <fn>\` to test

Use the Claude Code skills (/publish, /run, /validate, /add-function, /add-trigger, /status) for streamlined development.
`;
}

function gitignoreTemplate(): string {
  return `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
`;
}

function settingsTemplate(): string {
  return JSON.stringify({
    permissions: {
      allow: [
        'Bash(magically *)',
        'Bash(bun *)',
        'Bash(node *)',
      ],
    },
  }, null, 2) + '\n';
}

function helloFunctionTemplate(agentName: string, isContainer: boolean): string {
  if (isContainer) {
    return `// Container mode: runs as \`node functions/hello.js\` inside Docker
// The harness also calls module.exports if present, but this self-executes too.

async function hello() {
  const result = {
    message: 'Hello, world!',
    agent: '${agentName}',
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(result));
  return result;
}

// Self-execute when run directly (container mode)
if (require.main === module) {
  hello().catch(err => { console.error(err); process.exit(1); });
}

// Also export for in-process use via harness
module.exports = async function helloWrapped(ctx) {
  ctx.log.info('Hello from ${agentName}!');
  return hello();
};
`;
  }

  return `module.exports = async function hello(ctx) {
  ctx.log.info('Hello from ${agentName}!');

  return {
    message: 'Hello, world!',
    agent: '${agentName}',
    timestamp: Date.now(),
  };
};
`;
}

// ─── Docs ───────────────────────────────────────────────────────────────────────

function manifestReferenceMd(): string {
  return `# Manifest Reference

The \`manifest.json\` file declares everything about your agent: identity, functions, triggers, runtime, secrets, and config.

## Required Fields

### \`id\` (string)
Unique identifier. Lowercase alphanumeric and hyphens only: \`^[a-z0-9-]+$\`.

\`\`\`json
"id": "my-agent"
\`\`\`

### \`name\` (string)
Human-readable display name.

\`\`\`json
"name": "My Agent"
\`\`\`

### \`version\` (string)
Semantic version. Bumped on each publish.

\`\`\`json
"version": "1.0.0"
\`\`\`

### \`functions\` (array)
Array of callable functions. Each function has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`name\` | string | yes | Function identifier (matches filename in \`functions/\`) |
| \`description\` | string | yes | What this function does |
| \`parameters\` | object | no | JSON Schema for input parameters |
| \`run\` | string | no | Execution command (required for container agents) |

\`\`\`json
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
\`\`\`

## Optional Fields

### \`description\` (string)
Short description of what the agent does.

### \`icon\` (string)
Emoji or icon identifier for the agent.

### \`author\` (string)
Creator name.

### \`category\` (string)
Agent category for discovery (e.g., "social", "productivity", "developer-tools").

### \`color\` (string)
Hex color for UI theming (e.g., "#E1306C").

### \`tags\` (string[])
Tags for search and discovery.

### \`secrets\` (string[])
Environment variable names the agent needs. Only declared secrets are injected at runtime.

\`\`\`json
"secrets": ["API_KEY", "WEBHOOK_URL"]
\`\`\`

### \`config\` (object)
User-configurable fields with schema:

\`\`\`json
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
\`\`\`

Supported types: \`string\`, \`number\`, \`boolean\`, \`array\`, \`text\` (multiline string).

### \`runtime\` (object)
Container configuration. **Omit this entirely for lightweight (in-process) agents.**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`base\` | string | yes | Docker base image (e.g., \`node:20-slim\`, \`python:3.12-slim\`) |
| \`system\` | string[] | no | System packages to install via apt-get |
| \`install\` | string | no | Install command (e.g., \`pip install requests\`) |

\`\`\`json
"runtime": {
  "base": "python:3.12-slim",
  "system": ["chromium", "fonts-noto"],
  "install": "pip install playwright && playwright install chromium --with-deps"
}
\`\`\`

### \`triggers\` (array)
Triggers that auto-invoke functions on a schedule or event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`type\` | string | yes | Trigger type: \`cron\`, \`event\`, \`webhook\` |
| \`name\` | string | yes | Display name |
| \`entrypoint\` | string | yes | Function name to call |
| \`schedule\` | string | no | Cron expression (for \`cron\` type) |

\`\`\`json
"triggers": [
  {
    "type": "cron",
    "name": "Hourly Check",
    "entrypoint": "check",
    "schedule": "0 * * * *"
  }
]
\`\`\`

### \`ui\` (object)
React UI entry point for agents with a visual interface.

\`\`\`json
"ui": {
  "entry": "ui/App.tsx",
  "widget": "widget.json"
}
\`\`\`

### \`permissions\` (object)
Permissions the agent requires.

\`\`\`json
"permissions": {
  "data": [],
  "actions": [],
  "memory": "none"
}
\`\`\`

## Minimum Valid Manifest

\`\`\`json
{
  "id": "my-agent",
  "name": "My Agent",
  "version": "1.0.0",
  "functions": []
}
\`\`\`
`;
}

function functionContractMd(): string {
  return `# Function Contract

## The Pattern

Every function is a JavaScript file in \`functions/\` that exports an async function:

\`\`\`javascript
module.exports = async function myFunction(ctx, params) {
  // Your logic here
  return { result: 'value' };
};
\`\`\`

## The \`ctx\` Object

The runtime injects a context object with these capabilities:

| Property | Type | Description |
|----------|------|-------------|
| \`ctx.log.info(msg, data?)\` | function | Log at info level |
| \`ctx.log.warn(msg, data?)\` | function | Log at warn level |
| \`ctx.log.error(msg, data?)\` | function | Log at error level |
| \`ctx.secrets\` | object | Key-value map of declared secrets |
| \`ctx.config\` | object | User-configured values |
| \`ctx.emit(event, data)\` | function | Emit events (e.g., feed updates) |
| \`ctx.llm.ask(question)\` | function | Ask the platform LLM a question |
| \`ctx.agentDir\` | string | Path to the agent directory |

## Container Execution

When an agent has a \`runtime\` block in its manifest, functions run inside Docker containers.

### How It Works

1. At publish time, \`_harness.js\` is injected into the agent bundle
2. The container runs \`node _harness.js\`
3. The harness reads \`MAGICALLY_FUNCTION\` environment variable
4. It \`require()\`s \`functions/<name>.js\` and calls the exported function
5. The function receives \`ctx\` constructed from environment variables

### Environment Variables in Containers

| Variable | Description |
|----------|-------------|
| \`MAGICALLY_AGENT_ID\` | The agent's ID |
| \`MAGICALLY_FUNCTION\` | Which function to run |
| \`MAGICALLY_TRIGGER\` | JSON with trigger info (type, source, payload) |
| Plus all declared secrets | Each secret as its own env var |

### Non-JavaScript Functions

For Python, Go, Rust, etc., functions don't use the harness. They:

1. Read environment variables directly
2. Execute their logic
3. Print JSON to stdout (captured as the run result)

Example \`run\` command: \`"run": "python scripts/analyze.py"\`

The Python script reads \`os.environ['MAGICALLY_FUNCTION']\`, \`os.environ['MY_SECRET']\`, etc.

## Return Values

- The return value of your function is stored as the run result
- For container agents, JSON printed to stdout is captured
- Errors thrown are caught and stored as run errors
- All \`ctx.log\` calls are captured in the run logs

## Best Practices

1. Always use \`ctx.log\` instead of \`console.log\` — logs are captured and stored
2. Declare all secrets in the manifest — undeclared secrets won't be injected
3. Keep functions focused — one function, one responsibility
4. Return structured data — makes results queryable
5. Use \`ctx.emit('feed', ...)\` for user-visible updates
`;
}

function triggersAndConfigMd(): string {
  return `# Triggers, Secrets & Config

## Triggers

Triggers auto-invoke functions on a schedule or in response to events.

### Cron Triggers

Run a function on a schedule using cron expressions:

\`\`\`json
{
  "type": "cron",
  "name": "Hourly Check",
  "entrypoint": "check",
  "schedule": "0 * * * *"
}
\`\`\`

The \`entrypoint\` must match a function name in the \`functions\` array.

### Cron Expression Reference

| Expression | Meaning |
|-----------|---------|
| \`* * * * *\` | Every minute |
| \`0 * * * *\` | Every hour |
| \`0 9 * * *\` | Daily at 9am UTC |
| \`0 9 * * 1-5\` | Weekdays at 9am UTC |
| \`0 */4 * * *\` | Every 4 hours |
| \`0 0 1 * *\` | First of every month |

### Event Triggers (Planned)

React to events from other agents:

\`\`\`json
{
  "type": "event",
  "name": "On New Post",
  "entrypoint": "handleNewPost",
  "event": "feed.new"
}
\`\`\`

### Webhook Triggers (Planned)

Receive HTTP requests from external services:

\`\`\`json
{
  "type": "webhook",
  "name": "GitHub Push",
  "entrypoint": "onPush"
}
\`\`\`

## Secrets

Secrets are sensitive values (API keys, tokens) that your agent needs.

### Declaring Secrets

In \`manifest.json\`:
\`\`\`json
"secrets": ["API_KEY", "WEBHOOK_URL"]
\`\`\`

### Setting Secrets

\`\`\`bash
magically secrets set <agentId> API_KEY=sk-123456
\`\`\`

### Accessing Secrets

In your function:
\`\`\`javascript
module.exports = async function myFn(ctx) {
  const apiKey = ctx.secrets.API_KEY;
};
\`\`\`

In containers, secrets are injected as environment variables.

### Security

- Only secrets declared in the manifest are injected
- Never hardcode secrets in source files — the validation pipeline scans for them
- Secrets are stored in the platform database (encryption at rest planned)

## Config

Config fields are user-configurable values set at install time.

### Declaring Config

In \`manifest.json\`:
\`\`\`json
"config": {
  "frequency": {
    "type": "number",
    "label": "Check frequency (hours)",
    "default": 4,
    "required": false
  }
}
\`\`\`

### Supported Types

| Type | Description |
|------|-------------|
| \`string\` | Single-line text |
| \`number\` | Numeric value |
| \`boolean\` | True/false toggle |
| \`array\` | List of values |
| \`text\` | Multi-line text |

### Accessing Config

\`\`\`javascript
module.exports = async function myFn(ctx) {
  const freq = ctx.config.frequency;
};
\`\`\`
`;
}

function publishPipelineMd(): string {
  return `# Publish Pipeline

## Overview

Publishing an agent makes it available to run on the Magically platform. The process varies depending on whether your agent is lightweight or containerized.

## Steps

### 1. Local Validation

\`magically publish .\` first runs the validation pipeline:

1. **manifest-exists** — checks \`manifest.json\` exists and is valid JSON
2. **manifest-schema** — validates against the Zod schema
3. **functions-exist** — verifies all declared function files exist
4. **functions-executable** — checks JS functions use \`module.exports\`
5. **no-hardcoded-secrets** — scans for leaked API keys

If any check fails with severity \`error\`, publishing stops.

Use \`magically publish . --validate-only\` to run checks without publishing.

### 2. Bundle

The CLI creates a \`tar.gz\` archive of the agent directory, injecting \`_harness.js\` for container agents.

### 3. Upload

The bundle is uploaded to Tigris (S3-compatible storage) via the runtime API.

### 4. Build (Container Agents Only)

If the agent has a \`runtime\` block:

1. A BullMQ job is enqueued
2. A GitHub Actions workflow downloads the bundle from Tigris
3. A Docker image is built from the generated Dockerfile
4. The image is pushed to GHCR (primary) and Fly registry (for Fly Machines)

### 5. Status

Track build progress:

\`\`\`bash
magically status <agentId>
\`\`\`

Status lifecycle: \`processing\` → \`building\` → \`live\` | \`failed\`

## Running

Once published (status = \`live\`):

\`\`\`bash
magically run <agentId> <functionName>
magically run <agentId> <functionName> --payload '{"key": "value"}'
\`\`\`

The runtime selects a compute provider (Fly Machines in production, Docker locally) and runs the function.
`;
}

// ─── Skills ─────────────────────────────────────────────────────────────────────

function skillPublish(): string {
  return `---
name: publish
description: Validate and publish this agent to the Magically registry
allowed-tools: Bash, Read, Glob
disable-model-invocation: true
user-invocable: true
---

Publish the current agent to the Magically registry.

## Steps

1. Read \`manifest.json\` to confirm agent ID and version
2. Run \`magically publish .\` from the agent root directory
3. If validation fails, show the errors and suggest fixes
4. If publish succeeds, show the status and run \`magically status <agentId>\` to track the build
5. Report the final status (live or failed)

## Notes

- Validation runs automatically before upload
- Container agents (with \`runtime\` block) trigger a remote Docker build
- Lightweight agents go live immediately
- Use \`magically publish . --validate-only\` to check without publishing
`;
}

function skillRun(): string {
  return `---
name: run
description: Run an agent function via the runtime API
argument-hint: <functionName> [--payload '{}']
allowed-tools: Bash, Read
disable-model-invocation: true
user-invocable: true
---

Run a function of this agent via the Magically runtime.

## Steps

1. Read \`manifest.json\` to get the agent ID
2. If \`$ARGUMENTS\` is provided, use it as the function name
3. If no function name provided, list available functions from manifest and ask which to run
4. Run: \`magically run <agentId> <functionName>\`
5. If \`--payload\` is needed, construct a JSON payload from the function's parameters schema
6. Show the result and logs

## Notes

- The agent must be published and in \`live\` status to run
- Use \`magically status <agentId>\` to check if the agent is ready
`;
}

function skillValidate(): string {
  return `---
name: validate
description: Run validation checks without publishing
allowed-tools: Bash, Read, Glob
user-invocable: true
---

Run the validation pipeline on this agent without publishing.

## Steps

1. Run \`magically publish . --validate-only\`
2. Show the results of each check (pass/fail)
3. If any check fails, explain what's wrong and suggest fixes
4. Checks run: manifest-exists, manifest-schema, functions-exist, functions-executable, no-hardcoded-secrets
`;
}

function skillAddFunction(): string {
  return `---
name: add-function
description: Add a new function to this agent
argument-hint: <functionName>
allowed-tools: Read, Write, Edit, Bash, Glob
user-invocable: true
---

Scaffold a new function and register it in the manifest.

## Steps

1. Get the function name from \`$ARGUMENTS\` (or ask if not provided)
2. Read \`manifest.json\` to check for duplicates and understand agent type
3. Create \`functions/<name>.js\` with the standard module.exports pattern:

\`\`\`javascript
module.exports = async function <name>(ctx, params) {
  ctx.log.info('Running <name>');
  // TODO: implement
  return {};
};
\`\`\`

4. Add the function entry to \`manifest.json\` functions array:

\`\`\`json
{
  "name": "<name>",
  "description": "",
  "parameters": {}
}
\`\`\`

If the agent has a \`runtime\` block (container agent), also add \`"run": "node functions/<name>.js"\`.

5. Run \`magically publish . --validate-only\` to verify everything is valid
6. Remind the developer to implement the function logic and set the description
`;
}

function skillAddTrigger(): string {
  return `---
name: add-trigger
description: Add a trigger to this agent
argument-hint: <triggerType> <entrypoint>
allowed-tools: Read, Write, Edit
user-invocable: true
---

Add a trigger to the agent's manifest.

## Steps

1. Parse \`$ARGUMENTS\` for trigger type and entrypoint (or ask if not provided)
2. Read \`manifest.json\` to get current triggers and verify the entrypoint function exists
3. If trigger type is \`cron\`, ask for the cron schedule expression
4. Add the trigger to the manifest's \`triggers\` array:

\`\`\`json
{
  "type": "cron",
  "name": "Descriptive Name",
  "entrypoint": "<functionName>",
  "schedule": "<cron expression>"
}
\`\`\`

5. Verify the entrypoint matches an existing function in the functions array

## Supported Trigger Types

- \`cron\` — runs on a schedule (requires \`schedule\` field with cron expression)
- \`event\` — reacts to platform events (planned)
- \`webhook\` — receives HTTP requests (planned)
`;
}

function skillStatus(): string {
  return `---
name: status
description: Check build status after publishing
allowed-tools: Bash, Read
disable-model-invocation: true
user-invocable: true
---

Check the build status of this agent.

## Steps

1. Read \`manifest.json\` to get the agent ID
2. Run \`magically status <agentId>\`
3. Report the status: processing, building, live, or failed
4. If failed, show the build error and suggest fixes
`;
}
