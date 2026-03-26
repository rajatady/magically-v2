import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, and, ilike, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { InjectDB, type DrizzleDB } from '../db';
import {
  agents,
  registryVersions,
  userAgentInstalls,
} from '../db/schema';
import { StorageService } from './storage.service';
import type { AgentBuildJobData } from '../build/build.processor';

export interface PublishResult {
  agentId: string;
  version: string;
  versionId: string;
  status: string;
}

export interface ListOptions {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class RegistryService {
  private readonly logger = new Logger(RegistryService.name);

  constructor(
    @InjectDB() private readonly db: DrizzleDB,
    private readonly storage: StorageService,
    @InjectQueue('agent-build') private readonly buildQueue: Queue,
  ) {}

  // ─── Publish ────────────────────────────────────────────────────────────────

  async publish(authorId: string, manifest: Record<string, any>, bundle?: Buffer): Promise<PublishResult> {
    const agentId = manifest.id as string;
    const version = manifest.version as string;
    const now = new Date();

    // Check if agent already exists
    const existing = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (existing.length > 0) {
      // Verify author
      if (existing[0].authorId !== authorId) {
        throw new ForbiddenException(`You are not the author of ${agentId}`);
      }

      // Update agent metadata + latest version
      await this.db
        .update(agents)
        .set({
          name: manifest.name,
          description: manifest.description,
          icon: manifest.icon,
          color: manifest.color,
          category: manifest.category,
          tags: manifest.tags ?? [],
          latestVersion: version,
          updatedAt: now,
        })
        .where(eq(agents.id, agentId));
    } else {
      // Create new agent
      await this.db.insert(agents).values({
        id: agentId,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        color: manifest.color,
        authorId,
        category: manifest.category,
        tags: manifest.tags ?? [],
        latestVersion: version,
        status: 'live',
        installs: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Upload bundle if provided
    let bundleUrl: string | undefined;
    if (bundle) {
      bundleUrl = await this.storage.uploadBundle(agentId, version, bundle);
    }

    // Determine initial status: if has runtime block and bundle, needs building
    const needsBuild = !!manifest.runtime && !!bundle;
    const status = needsBuild ? 'processing' : 'live';
    const versionId = randomUUID();

    // Create version record
    await this.db.insert(registryVersions).values({
      id: versionId,
      agentId,
      version,
      manifest,
      bundleUrl,
      status,
      publishedAt: now,
    });

    // Enqueue build job if needed
    if (needsBuild) {
      const jobData: AgentBuildJobData = {
        versionId,
        agentId,
        version,
        bundleUrl: bundleUrl!,
        manifest,
      };

      await this.buildQueue.add(`build-${agentId}-${version}`, jobData, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });

      this.logger.log(`Published ${agentId}@${version} — build queued`);
    } else {
      this.logger.log(`Published ${agentId}@${version} — live`);
    }

    return { agentId, version, versionId, status };
  }

  // ─── Discovery ──────────────────────────────────────────────────────────────

  async listAgents(opts: ListOptions = {}) {
    const { category, search, limit = 50, offset = 0 } = opts;

    let query = this.db
      .select()
      .from(agents)
      .where(eq(agents.status, 'live'))
      .limit(limit)
      .offset(offset);

    if (category) {
      query = this.db
        .select()
        .from(agents)
        .where(and(eq(agents.status, 'live'), eq(agents.category, category)))
        .limit(limit)
        .offset(offset);
    }

    if (search) {
      query = this.db
        .select()
        .from(agents)
        .where(and(
          eq(agents.status, 'live'),
          ilike(agents.name, `%${search}%`),
        ))
        .limit(limit)
        .offset(offset);
    }

    return query;
  }

  async getAgent(agentId: string) {
    const rows = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    return rows[0] ?? null;
  }

  async getVersion(agentId: string, version: string) {
    const rows = await this.db
      .select()
      .from(registryVersions)
      .where(and(
        eq(registryVersions.agentId, agentId),
        eq(registryVersions.version, version),
      ))
      .limit(1);

    return rows[0] ?? null;
  }

  // ─── Install ────────────────────────────────────────────────────────────────

  async install(userId: string, agentId: string) {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found in registry`);
    }

    // Check if already installed
    const existing = await this.db
      .select()
      .from(userAgentInstalls)
      .where(and(
        eq(userAgentInstalls.userId, userId),
        eq(userAgentInstalls.agentId, agentId),
      ))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException(`Agent ${agentId} is already installed`);
    }

    const now = new Date();
    const install = {
      id: randomUUID(),
      userId,
      agentId,
      version: agent.latestVersion,
      config: {},
      enabled: true,
      installedAt: now,
      updatedAt: now,
    };

    await this.db.insert(userAgentInstalls).values(install);

    // Increment install count
    await this.db
      .update(agents)
      .set({ installs: sql`${agents.installs} + 1` })
      .where(eq(agents.id, agentId));

    this.logger.log(`User ${userId} installed ${agentId}@${agent.latestVersion}`);

    return install;
  }

  async uninstall(userId: string, agentId: string) {
    await this.db
      .delete(userAgentInstalls)
      .where(and(
        eq(userAgentInstalls.userId, userId),
        eq(userAgentInstalls.agentId, agentId),
      ));

    this.logger.log(`User ${userId} uninstalled ${agentId}`);
  }

  // ─── Config ─────────────────────────────────────────────────────────────────

  async getInstall(userId: string, agentId: string) {
    const rows = await this.db
      .select()
      .from(userAgentInstalls)
      .where(and(
        eq(userAgentInstalls.userId, userId),
        eq(userAgentInstalls.agentId, agentId),
      ))
      .limit(1);

    return rows[0] ?? null;
  }

  async updateConfig(userId: string, agentId: string, config: Record<string, unknown>) {
    await this.db
      .update(userAgentInstalls)
      .set({ config, updatedAt: new Date() })
      .where(and(
        eq(userAgentInstalls.userId, userId),
        eq(userAgentInstalls.agentId, agentId),
      ));
  }

  async listInstalls(userId: string) {
    return this.db
      .select()
      .from(userAgentInstalls)
      .where(eq(userAgentInstalls.userId, userId));
  }
}
