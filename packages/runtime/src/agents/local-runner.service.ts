import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import type { FeedItemType } from '../events/feed.service';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { InjectDB, type DrizzleDB } from '../db';
import { agents } from '../db/schema';
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
    @InjectDB() private readonly db: DrizzleDB,
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

  async isRegistered(agentId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);
    return rows.length > 0;
  }

  async run(agentId: string, functionName: string, userId: string, payload?: Record<string, unknown>): Promise<LocalRunResult> {
    // Agent must be registered in DB before running (for feed FK constraints)
    if (!(await this.isRegistered(agentId))) {
      throw new BadRequestException(
        `Agent '${agentId}' is not registered. Run 'magically register ${agentId}' or POST /api/agents/register first.`,
      );
    }

    const agentDir = resolve(join(this.agentsDir, agentId));
    const manifest = this.loadManifest(agentId);

    const fn = manifest.functions.find((f) => f.name === functionName);
    if (!fn) {
      const available = manifest.functions.map((f) => f.name).join(', ');
      throw new NotFoundException(`Function '${functionName}' not declared in ${agentId}. Available: ${available}`);
    }

    this.logger.log(`Running ${agentId}/${functionName} (local, worker thread)`);

    // Load secrets from process env
    const secrets: Record<string, string> = {};
    for (const key of manifest.secrets ?? []) {
      const val = process.env[key];
      if (val) secrets[key] = val;
    }

    const functionPath = join(agentDir, 'functions', `${functionName}.js`);
    if (!existsSync(functionPath)) {
      throw new NotFoundException(`Function file not found: functions/${functionName}.js`);
    }

    const startedAt = Date.now();
    const { Worker } = require('worker_threads');
    // Worker is plain JS — resolve from src/ since ts-node/bun runs from there,
    // and from dist/ in production. Check src first.
    const srcWorker = join(__dirname, '..', '..', 'src', 'agents', 'agent-worker.js');
    const distWorker = join(__dirname, 'agent-worker.js');
    const workerPath = existsSync(srcWorker) ? srcWorker : distWorker;

    return new Promise<LocalRunResult>((resolvePromise) => {
      const worker = new Worker(workerPath, {
        workerData: { agentDir, functionName, functionPath, agentId, secrets, payload },
      });

      worker.on('message', (msg: { type: string; level?: string; message?: string; data?: unknown; event?: string }) => {
        switch (msg.type) {
          case 'log':
            this.logger.log(`[${agentId}] ${msg.message} ${msg.data ? JSON.stringify(msg.data) : ''}`);
            break;

          case 'emit':
            if (msg.event === 'widget') {
              const widgetData = msg.data as { size?: string; html: string } | undefined;
              if (widgetData?.html) {
                this.widgetService.upsert({ userId, agentId, size: widgetData.size ?? 'medium', html: widgetData.html })
                  .catch((err) => this.logger.error(`Widget emit failed: ${err instanceof Error ? err.message : String(err)}`));
              }
            } else {
              const feedData = msg.data as Record<string, unknown> | undefined;
              this.feedService.create({
                agentId,
                type: ((feedData?.type as string) ?? msg.event ?? 'info') as FeedItemType,
                title: (feedData?.title as string) ?? msg.event ?? 'event',
                body: feedData?.body as string | undefined,
                data: feedData,
              }).catch((err) => this.logger.error(`Feed emit failed: ${err instanceof Error ? err.message : String(err)}`));
            }
            break;

          case 'result': {
            const durationMs = Date.now() - startedAt;
            this.logger.log(`${agentId}/${functionName} OK (${durationMs}ms)`);
            resolvePromise({ agentId, functionName, status: 'success', result: msg.data, durationMs });
            break;
          }

          case 'error': {
            const durationMs = Date.now() - startedAt;
            this.logger.error(`${agentId}/${functionName} FAILED (${durationMs}ms): ${msg.message}`);
            resolvePromise({ agentId, functionName, status: 'error', error: msg.message, durationMs });
            break;
          }
        }
      });

      worker.on('error', (err: Error) => {
        const durationMs = Date.now() - startedAt;
        this.logger.error(`${agentId}/${functionName} WORKER ERROR (${durationMs}ms): ${err.message}`);
        resolvePromise({ agentId, functionName, status: 'error', error: err.message, durationMs });
      });

      worker.on('exit', (code: number) => {
        if (code !== 0) {
          const durationMs = Date.now() - startedAt;
          resolvePromise({ agentId, functionName, status: 'error', error: `Worker exited with code ${code}`, durationMs });
        }
      });
    });
  }

}
