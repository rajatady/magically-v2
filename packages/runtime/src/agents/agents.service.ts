import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { InjectDB, type DrizzleDB } from '../db';
import { agents, agentVersions } from '../db/schema';

export interface AgentWithManifest {
  id: string;
  name: string;
  latestVersion: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  category: string | null;
  status: string;
  enabled: boolean;
  manifest: Record<string, unknown>;
}

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(@InjectDB() private readonly db: DrizzleDB) {}

  async findAll(): Promise<AgentWithManifest[]> {
    const rows = await this.db
      .select()
      .from(agents)
      .where(eq(agents.status, 'live'));

    const result: AgentWithManifest[] = [];
    for (const agent of rows) {
      const version = await this.getLatestVersion(agent.id);
      if (!version) continue;
      result.push({
        id: agent.id,
        name: agent.name,
        latestVersion: agent.latestVersion,
        description: agent.description,
        icon: agent.icon,
        color: agent.color,
        category: agent.category,
        status: agent.status,
        enabled: agent.enabled,
        manifest: version.manifest as Record<string, unknown>,
      });
    }
    return result;
  }

  /** All agents authored by a user — drafts, building, live */
  async findByAuthor(userId: string): Promise<AgentWithManifest[]> {
    const rows = await this.db
      .select()
      .from(agents)
      .where(eq(agents.authorId, userId))
      .orderBy(desc(agents.updatedAt));

    const result: AgentWithManifest[] = [];
    for (const agent of rows) {
      // For drafts/processing, there may be no live version yet — use latest of any status
      const version = await this.getAnyLatestVersion(agent.id);
      result.push({
        id: agent.id,
        name: agent.name,
        latestVersion: agent.latestVersion,
        description: agent.description,
        icon: agent.icon,
        color: agent.color,
        category: agent.category,
        status: agent.status,
        enabled: agent.enabled,
        manifest: (version?.manifest ?? {}) as Record<string, unknown>,
      });
    }
    return result;
  }

  async findOne(id: string): Promise<AgentWithManifest> {
    const rows = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1);

    if (rows.length === 0) throw new NotFoundException(`Agent '${id}' not found`);

    const agent = rows[0];
    const version = await this.getLatestVersion(id);
    if (!version) throw new NotFoundException(`Agent '${id}' has no published version`);

    return {
      id: agent.id,
      name: agent.name,
      latestVersion: agent.latestVersion,
      description: agent.description,
      icon: agent.icon,
      color: agent.color,
      category: agent.category,
      status: agent.status,
      enabled: agent.enabled,
      manifest: version.manifest as Record<string, unknown>,
    };
  }

  async getManifest(id: string): Promise<Record<string, unknown>> {
    const agent = await this.findOne(id);
    return agent.manifest;
  }

  async enable(id: string) {
    await this.db
      .update(agents)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(agents.id, id));
  }

  async disable(id: string) {
    await this.db
      .update(agents)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(agents.id, id));
  }

  private async getLatestVersion(agentId: string) {
    const rows = await this.db
      .select()
      .from(agentVersions)
      .where(and(
        eq(agentVersions.agentId, agentId),
        eq(agentVersions.status, 'live'),
      ))
      .limit(1);

    return rows[0] ?? null;
  }

  private async getAnyLatestVersion(agentId: string) {
    const rows = await this.db
      .select()
      .from(agentVersions)
      .where(eq(agentVersions.agentId, agentId))
      .orderBy(desc(agentVersions.publishedAt))
      .limit(1);

    return rows[0] ?? null;
  }
}
