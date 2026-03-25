import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { join } from 'path';
import { eq } from 'drizzle-orm';
import { AgentsService } from './agents.service.js';
import { FeedService } from '../events/feed.service.js';
import { DatabaseService } from '../db/database.service.js';
import { agentSecrets } from '../db/schema.js';
import { LlmService } from '../llm/llm.service.js';
import { ComputeProvider } from './compute/compute-provider.js';
import { DockerProvider } from './compute/docker-provider.js';
import { FlyProvider } from './compute/fly-provider.js';
import type { AgentContext, AgentFunctionHandler, AgentLog } from './agent-context.js';
import type { AgentInstance } from './types.js';

export interface RunLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface RunResult {
  agentId: string;
  functionName: string;
  status: 'success' | 'error';
  result?: unknown;
  error?: string;
  logs: RunLog[];
  durationMs: number;
  startedAt: number;
}

@Injectable()
export class FunctionRunnerService implements OnModuleInit {
  private readonly logger = new Logger(FunctionRunnerService.name);
  private computeProvider: ComputeProvider | null = null;

  constructor(
    private readonly agents: AgentsService,
    private readonly feed: FeedService,
    private readonly db: DatabaseService,
    private readonly llmService: LlmService,
    private readonly nestConfig: NestConfigService,
  ) {}

  onModuleInit() {
  }

  /** Resolve compute provider based on COMPUTE_PROVIDER config. Cached after first call. */
  private async getComputeProvider(): Promise<ComputeProvider> {
    if (this.computeProvider) return this.computeProvider;

    const preference = this.nestConfig.get<string>('COMPUTE_PROVIDER', 'auto');

    if (preference === 'fly') {
      const fly = new FlyProvider(this.nestConfig);
      if (await fly.isAvailable()) {
        this.computeProvider = fly;
        this.logger.log('Compute provider: Fly Machines (configured)');
        return fly;
      }
      throw new Error('COMPUTE_PROVIDER=fly but Fly is not configured (missing FLY_API_TOKEN or FLY_AGENTS_APP)');
    }

    if (preference === 'docker') {
      const docker = new DockerProvider();
      if (await docker.isAvailable()) {
        this.computeProvider = docker;
        this.logger.log('Compute provider: Docker (configured)');
        return docker;
      }
      throw new Error('COMPUTE_PROVIDER=docker but Docker is not available');
    }

    // auto: try Fly first, then Docker
    const fly = new FlyProvider(this.nestConfig);
    if (await fly.isAvailable()) {
      this.computeProvider = fly;
      this.logger.log('Compute provider: Fly Machines (auto)');
      return fly;
    }

    const docker = new DockerProvider();
    if (await docker.isAvailable()) {
      this.computeProvider = docker;
      this.logger.log('Compute provider: Docker (auto)');
      return docker;
    }

    throw new Error(
      'No compute provider available. Set COMPUTE_PROVIDER=fly or COMPUTE_PROVIDER=docker, or install Docker.',
    );
  }

  /** Load secrets for an agent from the DB, filtered to what the manifest declares. */
  private loadSecrets(agentId: string, declaredSecrets: string[]): Record<string, string> {
    if (declaredSecrets.length === 0) return {};

    const rows = this.db.db
      .select()
      .from(agentSecrets)
      .where(eq(agentSecrets.agentId, agentId))
      .all();

    const secrets: Record<string, string> = {};
    for (const row of rows) {
      if (declaredSecrets.includes(row.key)) {
        secrets[row.key] = row.value;
      }
    }
    return secrets;
  }

  async run(
    agentId: string,
    functionName: string,
    trigger: AgentContext['trigger'],
  ): Promise<RunResult> {
    const inst = this.agents.findOne(agentId);
    const manifest = inst.manifest;

    // Verify function is declared in manifest
    const declared = manifest.functions.find((f) => f.name === functionName);
    if (!declared) {
      throw new Error(
        `Function '${functionName}' is not declared in ${agentId} manifest`,
      );
    }

    // Container agents → compute provider. Lightweight agents → in-process.
    if (manifest.runtime) {
      return this.runInContainer(inst, functionName, trigger);
    }
    return this.runInProcess(inst, functionName, trigger);
  }

  // ─── Lightweight: run in-process (no runtime block) ───────────────────────

  private async runInProcess(
    inst: AgentInstance,
    functionName: string,
    trigger: AgentContext['trigger'],
  ): Promise<RunResult> {
    const { manifest } = inst;
    const agentId = manifest.id;

    const fnPath = join(inst.dir, 'functions', `${functionName}.js`);
    if (!existsSync(fnPath)) {
      throw new Error(
        `Function file not found: functions/${functionName}.js for agent ${agentId}`,
      );
    }

    const mod = require(fnPath);
    const handler: AgentFunctionHandler =
      typeof mod === 'function' ? mod : mod.default ?? mod;

    if (typeof handler !== 'function') {
      throw new Error(
        `functions/${functionName}.js does not export a function`,
      );
    }

    const { ctx, logs } = this.buildContext(inst, trigger);

    const startedAt = Date.now();
    try {
      const result = await handler(ctx, trigger.payload);
      const durationMs = Date.now() - startedAt;
      this.logger.log(`${agentId}/${functionName} completed in ${durationMs}ms`);
      return { agentId, functionName, status: 'success', result, logs, durationMs, startedAt };
    } catch (err: any) {
      const durationMs = Date.now() - startedAt;
      this.logger.error(`${agentId}/${functionName} failed: ${err.message}`);
      return { agentId, functionName, status: 'error', error: err.message, logs, durationMs, startedAt };
    }
  }

  // ─── Container: run via compute provider (runtime block present) ──────────

  private async runInContainer(
    inst: AgentInstance,
    functionName: string,
    trigger: AgentContext['trigger'],
  ): Promise<RunResult> {
    const { manifest } = inst;
    const agentId = manifest.id;
    const runtime = manifest.runtime!;
    const startedAt = Date.now();

    const provider = await this.getComputeProvider();
    this.logger.log(`Running ${agentId}/${functionName} via ${provider.name}`);

    // Build image
    const imageTag = `magically-agent-${agentId}:${manifest.version}`;
    const dockerfile = this.generateDockerfile(runtime);
    await provider.buildImage(agentId, inst.dir, dockerfile, imageTag);

    // Resolve the command to run
    const fn = manifest.functions.find((f) => f.name === functionName);
    const runCmd = fn?.run ?? `node functions/${functionName}.js`;
    const cmd = runCmd.split(' ');

    // Build env vars: secrets + trigger metadata
    const secrets = this.loadSecrets(agentId, manifest.secrets ?? []);
    const triggerJson = JSON.stringify({
      type: trigger.type,
      source: trigger.source,
      payload: trigger.payload,
    });

    const env: Record<string, string> = {
      ...secrets,
      MAGICALLY_AGENT_ID: agentId,
      MAGICALLY_FUNCTION: functionName,
      MAGICALLY_TRIGGER: triggerJson,
    };

    // For Fly: use registry image if agent has custom deps (pre-pushed),
    // otherwise use the public base image directly
    let image = imageTag;
    if (provider.name === 'fly') {
      if (runtime.install) {
        image = `registry.fly.io/${this.nestConfig.get('FLY_AGENTS_APP')}:${agentId}-${manifest.version}`;
      } else {
        image = runtime.base;
      }
    }

    // Run
    const output = await provider.run({
      agentId,
      functionName,
      image,
      cmd,
      env,
      timeoutSeconds: 300,
    });

    const logs: RunLog[] = output.logs.map((msg) => ({
      level: 'info' as const,
      message: msg,
      timestamp: Date.now(),
    }));

    const durationMs = Date.now() - startedAt;
    const status = output.exitCode === 0 ? 'success' : 'error';

    this.logger.log(
      `${agentId}/${functionName} (${provider.name}) ${status} in ${durationMs}ms (exit=${output.exitCode})`,
    );

    return {
      agentId,
      functionName,
      status,
      error: status === 'error' ? `Exit code ${output.exitCode}` : undefined,
      logs,
      durationMs,
      startedAt,
    };
  }

  // ─── Dockerfile generator ─────────────────────────────────────────────────

  private generateDockerfile(
    runtime: { base: string; system?: string[]; install?: string },
  ): string {
    const lines = [
      `FROM ${runtime.base}`,
      `WORKDIR /agent`,
      `COPY . /agent/`,
    ];

    if (runtime.system && runtime.system.length > 0) {
      lines.push(`RUN apt-get update && apt-get install -y ${runtime.system.join(' ')} && rm -rf /var/lib/apt/lists/*`);
    }

    if (runtime.install) {
      lines.push(`RUN ${runtime.install}`);
    }

    return lines.join('\n');
  }

  // ─── Context builder (in-process agents only) ─────────────────────────────

  private buildContext(
    inst: AgentInstance,
    trigger: AgentContext['trigger'],
  ): { ctx: AgentContext; logs: RunLog[] } {
    const agentId = inst.manifest.id;
    const logs: RunLog[] = [];

    const makeLog = (level: RunLog['level']) => {
      return (message: string, data?: Record<string, unknown>) => {
        logs.push({ level, message, data, timestamp: Date.now() });
      };
    };

    const log: AgentLog = {
      info: makeLog('info'),
      warn: makeLog('warn'),
      error: makeLog('error'),
    };

    const ctx: AgentContext = {
      agentId,
      agentDir: inst.dir,
      trigger,
      config: {},
      log,
      emit: (event: string, data?: unknown) => {
        if (event === 'feed' && data && typeof data === 'object') {
          const feedData = data as Record<string, unknown>;
          this.feed.create({
            agentId,
            type: (feedData.type as any) ?? 'info',
            title: (feedData.title as string) ?? '',
            body: feedData.body as string | undefined,
          });
        }
      },
      secrets: this.loadSecrets(agentId, inst.manifest.secrets ?? []),
      llm: {
        ask: (prompt: string) =>
          this.llmService.complete([{ role: 'user', content: prompt }]),
        askWithSystem: (systemPrompt: string, userPrompt: string) =>
          this.llmService.complete(
            [{ role: 'user', content: userPrompt }],
            undefined,
            systemPrompt,
          ),
      },
    };

    return { ctx, logs };
  }
}
