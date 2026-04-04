import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { authCommand } from './auth';

interface ManifestFunction {
  name: string;
  description?: string;
  run?: string;
  parameters?: Record<string, unknown>;
}

interface AgentManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  secrets?: string[];
  functions: ManifestFunction[];
  runtime?: {
    base: string;
    system?: string[];
    install?: string;
  };
}

interface AgentContext {
  agentId: string;
  agentDir: string;
  trigger: { type: string; source?: string; payload?: Record<string, unknown> };
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  log: {
    info(message: string, data?: Record<string, unknown>): void;
    warn(message: string, data?: Record<string, unknown>): void;
    error(message: string, data?: Record<string, unknown>): void;
  };
  emit(event: string, data?: unknown): void;
  llm: {
    ask(prompt: string): Promise<string>;
    askWithSystem(system: string, user: string): Promise<string>;
  };
}

type AgentFunctionHandler = (ctx: AgentContext, params?: Record<string, unknown>) => Promise<unknown>;

export const devCommand = {
  loadManifest(agentDir: string): AgentManifest {
    const manifestPath = join(agentDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error(`manifest.json not found in ${agentDir}`);
    }
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  },

  resolveFunction(manifest: AgentManifest, functionName: string): ManifestFunction {
    const fn = manifest.functions.find((f) => f.name === functionName);
    if (!fn) {
      const available = manifest.functions.map((f) => f.name).join(', ');
      throw new Error(
        `Function '${functionName}' not declared in manifest. Available: ${available}`,
      );
    }
    return fn;
  },

  buildContext(
    agentId: string,
    agentDir: string,
    secrets: Record<string, string>,
    runtimeUrl: string,
    payload?: Record<string, unknown>,
  ): AgentContext {
    return {
      agentId,
      agentDir,
      trigger: {
        type: 'manual',
        payload,
      },
      config: {},
      secrets,
      log: {
        info(message: string, data?: Record<string, unknown>) {
          console.log(`  [INFO] ${message}`, data ? JSON.stringify(data) : '');
        },
        warn(message: string, data?: Record<string, unknown>) {
          console.log(`  [WARN] ${message}`, data ? JSON.stringify(data) : '');
        },
        error(message: string, data?: Record<string, unknown>) {
          console.error(`  [ERROR] ${message}`, data ? JSON.stringify(data) : '');
        },
      },
      emit(event: string, data?: unknown) {
        const token = authCommand.loadToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        console.log(`  [EMIT] ${event}`, data ? JSON.stringify(data) : '');

        if (event === 'widget') {
          // Widget emit — upsert to /api/widgets
          const widgetData = data as { size?: string; html: string } | undefined;
          if (!widgetData?.html) return;

          fetch(`${runtimeUrl}/api/widgets`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ agentId, size: widgetData.size ?? 'medium', html: widgetData.html }),
          }).catch((err) => {
            console.error(`  [EMIT FAILED] ${err instanceof Error ? err.message : String(err)}`);
          });
        } else {
          // Feed emit — append to /api/feed
          const feedData = data as Record<string, unknown> | undefined;
          fetch(`${runtimeUrl}/api/feed`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              agentId,
              type: feedData?.type ?? event,
              title: feedData?.title ?? event,
              body: feedData?.body,
              data: feedData,
            }),
          }).catch((err) => {
            console.error(`  [EMIT FAILED] ${err instanceof Error ? err.message : String(err)}`);
          });
        }
      },
      llm: {
        async ask(_prompt: string): Promise<string> {
          throw new Error('LLM not available in local dev mode');
        },
        async askWithSystem(_system: string, _user: string): Promise<string> {
          throw new Error('LLM not available in local dev mode');
        },
      },
    };
  },

  loadFunctionHandler(agentDir: string, functionName: string): AgentFunctionHandler {
    const functionPath = join(agentDir, 'functions', `${functionName}.js`);
    if (!existsSync(functionPath)) {
      throw new Error(`Function file not found: ${functionPath}`);
    }

    // Clear require cache so re-runs pick up changes
    const resolved = require.resolve(functionPath);
    delete require.cache[resolved];

    const mod = require(functionPath);

    // Support: module.exports = async function, module.exports.default, or named export
    if (typeof mod === 'function') return mod;
    if (typeof mod.default === 'function') return mod.default;
    if (typeof mod[functionName] === 'function') return mod[functionName];

    throw new Error(
      `${functionPath} does not export a callable function. Export via module.exports = async function(ctx) { ... }`,
    );
  },

  loadSecretsFromEnv(declaredSecrets: string[]): Record<string, string> {
    const secrets: Record<string, string> = {};
    for (const key of declaredSecrets) {
      const val = process.env[key];
      if (val) {
        secrets[key] = val;
      }
    }
    return secrets;
  },

  async exec(agentDir: string, functionName: string, opts: { payload?: string; base?: string } = {}): Promise<void> {
    const absDir = resolve(agentDir);
    const base = opts.base ?? 'http://localhost:4321';
    const manifest = devCommand.loadManifest(absDir);
    const fn = devCommand.resolveFunction(manifest, functionName);

    console.log(`Running ${manifest.id}/${fn.name} (local dev)...\n`);

    // Load secrets from environment
    const secrets = devCommand.loadSecretsFromEnv(manifest.secrets ?? []);
    const missingSecrets = (manifest.secrets ?? []).filter((s) => !secrets[s]);
    if (missingSecrets.length > 0) {
      console.log(`  [WARN] Missing secrets (set as env vars): ${missingSecrets.join(', ')}\n`);
    }

    // Parse payload
    const payload = opts.payload ? JSON.parse(opts.payload) : undefined;

    // Build context and load handler
    const ctx = devCommand.buildContext(manifest.id, absDir, secrets, base, payload);
    const handler = devCommand.loadFunctionHandler(absDir, fn.name);

    // Run
    const startedAt = Date.now();
    try {
      const result = await handler(ctx, payload);
      const durationMs = Date.now() - startedAt;

      console.log(`\nOK (${durationMs}ms)`);
      if (result !== undefined) {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\nFAILED (${durationMs}ms): ${message}`);
      process.exit(1);
    }
  },
};
