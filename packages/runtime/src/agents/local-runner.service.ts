import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FeedItemType } from '../events/feed.service';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { FeedService } from '../events/feed.service';
import { WidgetService } from '../events/widget.service';

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
  triggers?: Array<{ type: string; name: string; entrypoint: string; schedule?: string }>;
}

export interface LocalRunResult {
  agentId: string;
  functionName: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
  durationMs: number;
}

@Injectable()
export class LocalRunnerService {
  private readonly logger = new Logger(LocalRunnerService.name);
  private readonly agentsDir: string;

  constructor(
    private readonly config: ConfigService,
    private readonly feedService: FeedService,
    private readonly widgetService: WidgetService,
  ) {
    this.agentsDir = this.config.get<string>('AGENTS_DIR') ?? join(process.cwd(), '..', '..', 'agents');
    this.logger.log(`Local agents dir: ${this.agentsDir}`);
  }

  listAgents(): string[] {
    const { readdirSync, statSync } = require('fs');
    try {
      return readdirSync(this.agentsDir)
        .filter((name: string) => {
          const dir = join(this.agentsDir, name);
          return statSync(dir).isDirectory() && existsSync(join(dir, 'manifest.json'));
        });
    } catch {
      return [];
    }
  }

  loadManifest(agentId: string): AgentManifest {
    const manifestPath = join(this.agentsDir, agentId, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new NotFoundException(`Agent '${agentId}' not found in ${this.agentsDir}`);
    }
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  }

  async run(agentId: string, functionName: string, userId: string, payload?: Record<string, unknown>): Promise<LocalRunResult> {
    const agentDir = resolve(join(this.agentsDir, agentId));
    const manifest = this.loadManifest(agentId);

    const fn = manifest.functions.find((f) => f.name === functionName);
    if (!fn) {
      const available = manifest.functions.map((f) => f.name).join(', ');
      throw new NotFoundException(`Function '${functionName}' not declared in ${agentId}. Available: ${available}`);
    }

    this.logger.log(`Running ${agentId}/${functionName} (local)`);

    // Load secrets from process env (same as CLI)
    const secrets: Record<string, string> = {};
    for (const key of manifest.secrets ?? []) {
      const val = process.env[key];
      if (val) secrets[key] = val;
    }

    // Build context
    const ctx = this.buildContext(agentId, agentDir, secrets, userId, payload);

    // Load and run function
    const functionPath = join(agentDir, 'functions', `${functionName}.js`);
    if (!existsSync(functionPath)) {
      throw new NotFoundException(`Function file not found: functions/${functionName}.js`);
    }

    const resolved = require.resolve(functionPath);
    delete require.cache[resolved];
    const mod = require(functionPath);

    const handler = typeof mod === 'function' ? mod
      : typeof mod.default === 'function' ? mod.default
      : typeof mod[functionName] === 'function' ? mod[functionName]
      : null;

    if (!handler) {
      throw new Error(`${functionPath} does not export a callable function`);
    }

    const startedAt = Date.now();
    try {
      const result = await handler(ctx, payload);
      const durationMs = Date.now() - startedAt;
      this.logger.log(`${agentId}/${functionName} OK (${durationMs}ms)`);
      return { agentId, functionName, status: 'success', result, durationMs };
    } catch (err: unknown) {
      const durationMs = Date.now() - startedAt;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`${agentId}/${functionName} FAILED (${durationMs}ms): ${message}`);
      return { agentId, functionName, status: 'error', error: message, durationMs };
    }
  }

  private buildContext(agentId: string, agentDir: string, secrets: Record<string, string>, userId: string, payload?: Record<string, unknown>) {
    const feedService = this.feedService;
    const widgetService = this.widgetService;

    return {
      agentId,
      agentDir,
      trigger: { type: 'manual' as const, payload },
      config: {},
      secrets,
      log: {
        info: (message: string, data?: Record<string, unknown>) => {
          this.logger.log(`[${agentId}] ${message} ${data ? JSON.stringify(data) : ''}`);
        },
        warn: (message: string, data?: Record<string, unknown>) => {
          this.logger.warn(`[${agentId}] ${message} ${data ? JSON.stringify(data) : ''}`);
        },
        error: (message: string, data?: Record<string, unknown>) => {
          this.logger.error(`[${agentId}] ${message} ${data ? JSON.stringify(data) : ''}`);
        },
      },
      emit: (event: string, data?: unknown) => {
        const feedData = data as Record<string, unknown> | undefined;

        if (event === 'widget') {
          const widgetData = data as { size?: string; html: string } | undefined;
          if (widgetData?.html) {
            widgetService.upsert({
              userId,
              agentId,
              size: widgetData.size ?? 'medium',
              html: widgetData.html,
            }).catch((err) => {
              this.logger.error(`Widget emit failed: ${err instanceof Error ? err.message : String(err)}`);
            });
          }
        } else {
          feedService.create({
            agentId,
            type: ((feedData?.type as string) ?? event) as FeedItemType,
            title: (feedData?.title as string) ?? event,
            body: feedData?.body as string | undefined,
            data: feedData,
          }).catch((err) => {
            this.logger.error(`Feed emit failed: ${err instanceof Error ? err.message : String(err)}`);
          });
        }
      },
      llm: {
        ask: async (_prompt: string): Promise<string> => {
          throw new Error('LLM not available in local run mode');
        },
        askWithSystem: async (_system: string, _user: string): Promise<string> => {
          throw new Error('LLM not available in local run mode');
        },
      },
    };
  }
}
