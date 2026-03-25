import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { join, resolve } from 'path';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { eq } from 'drizzle-orm';
import { InjectDB, type DrizzleDB } from '../db';
import { agents as agentsTable } from '../db/schema';
import {
  AgentInstance,
  AgentManifest,
  AgentManifestSchema,
} from './types';

@Injectable()
export class AgentsService implements OnModuleInit {
  private readonly logger = new Logger(AgentsService.name);
  private instances = new Map<string, AgentInstance>();

  constructor(@InjectDB() private readonly db: DrizzleDB) {}

  async onModuleInit() {
    await this.scanAgentsDir();
  }

  async scanAgentsDir(agentsDir?: string) {
    const dir = agentsDir
      ?? process.env.AGENTS_DIR
      ?? resolve(process.cwd(), '..', '..', 'agents');
    if (!existsSync(dir)) {
      this.logger.warn(`Agents directory not found: ${dir}`);
      return;
    }

    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agentDir = join(dir, entry.name);
      const manifestPath = join(agentDir, 'manifest.json');
      if (!existsSync(manifestPath)) continue;

      try {
        await this.loadAgent(agentDir, manifestPath);
      } catch (err) {
        this.logger.error(`Failed to load agent at ${agentDir}: ${err}`);
      }
    }

    this.logger.log(`Loaded ${this.instances.size} agents`);
  }

  async loadAgent(agentDir: string, manifestPath: string): Promise<AgentInstance> {
    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const manifest = AgentManifestSchema.parse(raw);

    const now = new Date();
    const instance: AgentInstance = {
      manifest,
      dir: agentDir,
      enabled: true,
      installedAt: now,
    };

    this.instances.set(manifest.id, instance);

    // Upsert into DB
    const existing = await this.db
      .select()
      .from(agentsTable)
      .where(eq(agentsTable.id, manifest.id))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(agentsTable)
        .set({ name: manifest.name, version: manifest.version, updatedAt: now })
        .where(eq(agentsTable.id, manifest.id));
    } else {
      await this.db.insert(agentsTable).values({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        icon: manifest.icon,
        color: manifest.color,
        author: manifest.author,
        manifestPath,
        enabled: true,
        installedAt: now,
        updatedAt: now,
      });
    }

    return instance;
  }

  findAll(): AgentInstance[] {
    return Array.from(this.instances.values());
  }

  findOne(id: string): AgentInstance {
    const instance = this.instances.get(id);
    if (!instance) throw new NotFoundException(`Agent '${id}' not found`);
    return instance;
  }

  async enable(id: string) {
    const inst = this.findOne(id);
    inst.enabled = true;
    await this.db
      .update(agentsTable)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(agentsTable.id, id));
  }

  async disable(id: string) {
    const inst = this.findOne(id);
    inst.enabled = false;
    await this.db
      .update(agentsTable)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(agentsTable.id, id));
  }

  getManifest(id: string): AgentManifest {
    return this.findOne(id).manifest;
  }
}
