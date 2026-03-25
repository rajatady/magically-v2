import { Injectable, Logger, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { eq, and, ilike, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { InjectDB, type DrizzleDB } from '../db';
import {
  registryAgents,
  registryVersions,
  userAgentInstalls,
} from '../db/schema';
import { StorageService } from './storage.service';

export interface PublishResult {
  agentId: string;
  version: string;
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
  ) {}

  // ─── Publish ────────────────────────────────────────────────────────────────

  async publish(authorId: string, manifest: Record<string, any>, bundle?: Buffer): Promise<PublishResult> {
    const agentId = manifest.id as string;
    const version = manifest.version as string;
    const now = new Date();

    // Check if agent already exists
    const existing = await this.db
      .select()
      .from(registryAgents)
      .where(eq(registryAgents.id, agentId))
      .limit(1);

    if (existing.length > 0) {
      // Verify author
      if (existing[0].authorId !== authorId) {
        throw new ForbiddenException(`You are not the author of ${agentId}`);
      }

      // Update agent metadata + latest version
      await this.db
        .update(registryAgents)
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
        .where(eq(registryAgents.id, agentId));
    } else {
      // Create new agent
      await this.db.insert(registryAgents).values({
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

    // Create version record
    await this.db.insert(registryVersions).values({
      id: randomUUID(),
      agentId,
      version,
      manifest,
      bundleUrl,
      status: 'live',
      publishedAt: now,
    });

    this.logger.log(`Published ${agentId}@${version}`);

    return { agentId, version, status: 'live' };
  }

  // ─── Discovery ──────────────────────────────────────────────────────────────

  async listAgents(opts: ListOptions = {}) {
    const { category, search, limit = 50, offset = 0 } = opts;

    let query = this.db
      .select()
      .from(registryAgents)
      .where(eq(registryAgents.status, 'live'))
      .limit(limit)
      .offset(offset);

    if (category) {
      query = this.db
        .select()
        .from(registryAgents)
        .where(and(eq(registryAgents.status, 'live'), eq(registryAgents.category, category)))
        .limit(limit)
        .offset(offset);
    }

    if (search) {
      query = this.db
        .select()
        .from(registryAgents)
        .where(and(
          eq(registryAgents.status, 'live'),
          ilike(registryAgents.name, `%${search}%`),
        ))
        .limit(limit)
        .offset(offset);
    }

    return query;
  }

  async getAgent(agentId: string) {
    const rows = await this.db
      .select()
      .from(registryAgents)
      .where(eq(registryAgents.id, agentId))
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
      .update(registryAgents)
      .set({ installs: sql`${registryAgents.installs} + 1` })
      .where(eq(registryAgents.id, agentId));

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
