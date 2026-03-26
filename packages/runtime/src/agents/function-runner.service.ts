import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { InjectDB, type DrizzleDB } from '../db';
import { agentSecrets, agentRuns, agentVersions } from '../db/schema';
import { AgentsService } from './agents.service';
import { FeedService } from '../events/feed.service';
import { LlmService } from '../llm/llm.service';
import { ComputeProvider } from './compute/compute-provider';
import { DockerProvider } from './compute/docker-provider';
import { FlyProvider } from './compute/fly-provider';
import { DaytonaProvider } from './compute/daytona-provider';
import type { AgentContext } from './agent-context';

export interface RunLog {
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface RunResult {
  runId?: string;
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
    @InjectDB() private readonly db: DrizzleDB,
    private readonly llmService: LlmService,
    private readonly nestConfig: NestConfigService,
  ) {}

  onModuleInit() {
  }

  /** Resolve compute provider based on COMPUTE_PROVIDER config. Cached after first call. */
  private async getComputeProvider(): Promise<ComputeProvider> {
    if (this.computeProvider) return this.computeProvider;

    const preference = this.nestConfig.get<string>('COMPUTE_PROVIDER', 'auto');

    if (preference === 'daytona') {
      const daytona = new DaytonaProvider(this.nestConfig);
      if (await daytona.isAvailable()) {
        this.computeProvider = daytona;
        this.logger.log('Compute provider: Daytona (configured)');
        return daytona;
      }
      throw new Error('COMPUTE_PROVIDER=daytona but Daytona is not configured (missing DAYTONA_API_KEY)');
    }

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

    // auto: try Daytona first, then Fly, then Docker
    const daytona = new DaytonaProvider(this.nestConfig);
    if (await daytona.isAvailable()) {
      this.computeProvider = daytona;
      this.logger.log('Compute provider: Daytona (auto)');
      return daytona;
    }

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
      'No compute provider available. Set COMPUTE_PROVIDER=daytona, fly, or docker.',
    );
  }

  /** Look up a pre-built image ref from the registry, using provider-specific ref when available. */
  private async getRegistryImageRef(agentId: string, version: string, providerName: string): Promise<string | null> {
    const rows = await this.db
      .select({
        imageRef: agentVersions.imageRef,
        flyImageRef: agentVersions.flyImageRef,
      })
      .from(agentVersions)
      .where(and(
        eq(agentVersions.agentId, agentId),
        eq(agentVersions.version, version),
        eq(agentVersions.status, 'live'),
      ))
      .limit(1);

    if (rows.length === 0) return null;

    const row = rows[0];
    if (providerName === 'fly' && row.flyImageRef) return row.flyImageRef;
    return row.imageRef ?? null;
  }

  private async loadSecrets(agentId: string, declaredSecrets: string[]): Promise<Record<string, string>> {
    if (declaredSecrets.length === 0) return {};

    const rows = await this.db
      .select()
      .from(agentSecrets)
      .where(eq(agentSecrets.agentId, agentId));

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
    const agent = await this.agents.findOne(agentId);
    const manifest = agent.manifest as any;

    // Verify function is declared in manifest
    const declared = manifest.functions?.find((f: any) => f.name === functionName);
    if (!declared) {
      throw new Error(
        `Function '${functionName}' is not declared in ${agentId} manifest`,
      );
    }

    // Create run record
    const runId = randomUUID();
    const now = new Date();
    await this.db.insert(agentRuns).values({
      id: runId,
      agentId,
      functionName,
      triggerType: trigger.type,
      triggerSource: trigger.source,
      status: 'running',
      startedAt: now,
      createdAt: now,
    });

    // Execute — container agents have a runtime block, lightweight don't
    const isContainer = !!manifest.runtime;
    const result = isContainer
      ? await this.runInContainer(agentId, manifest, functionName, trigger)
      : await this.runLightweight(agentId, manifest, functionName, trigger);

    // Update run record with result
    await this.db
      .update(agentRuns)
      .set({
        status: result.status,
        computeProvider: isContainer ? (this.computeProvider?.name ?? 'unknown') : 'in-process',
        result: result.result != null ? result.result : undefined,
        error: result.error,
        logs: result.logs,
        durationMs: result.durationMs,
        completedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId));

    return { ...result, runId };
  }

  // ─── Lightweight: agents without a runtime block ────────────────────────
  // TODO: Lightweight agents need a different execution model since there's no
  // filesystem path. Options: (a) download bundle from Tigris and run in-process,
  // (b) always require a runtime block (all agents are containers).

  private async runLightweight(
    agentId: string,
    manifest: any,
    functionName: string,
    trigger: AgentContext['trigger'],
  ): Promise<RunResult> {
    throw new Error(
      `Agent ${agentId} has no runtime block. Lightweight (in-process) agents are not yet supported in registry mode. Add a runtime block to the manifest.`,
    );
  }

  // ─── Container: run via compute provider (runtime block present) ──────────

  private async runInContainer(
    agentId: string,
    manifest: any,
    functionName: string,
    trigger: AgentContext['trigger'],
  ): Promise<RunResult> {
    const runtime = manifest.runtime;
    const version = manifest.version;
    const startedAt = Date.now();

    const provider = await this.getComputeProvider();
    this.logger.log(`Running ${agentId}/${functionName} via ${provider.name}`);

    // Resolve image from agent_versions
    const registryImage = await this.getRegistryImageRef(agentId, version, provider.name);
    if (!registryImage) {
      throw new Error(`No built image found for ${agentId}@${version}. Has it been published?`);
    }
    const image = registryImage;

    // Resolve the command to run
    const fn = manifest.functions?.find((f: any) => f.name === functionName);
    const runCmd = fn?.run ?? `node functions/${functionName}.js`;

    // For JS functions, use the harness which handles module.exports calling
    const isJsFunction = runCmd.startsWith('node ');
    const cmd = isJsFunction
      ? ['node', '_harness.js']
      : runCmd.split(' ');

    // Build env vars: secrets + trigger metadata
    const secrets = await this.loadSecrets(agentId, manifest.secrets ?? []);
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

}
