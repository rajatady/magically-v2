import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { InjectDB, type DrizzleDB } from '../db';
import { agents } from '../db/schema';

interface LocalManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  color?: string;
  category?: string;
  tags?: string[];
}

@Injectable()
export class LocalDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(LocalDiscoveryService.name);
  private readonly agentsDir: string;

  constructor(
    @InjectDB() private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    this.agentsDir = this.config.get<string>('AGENTS_DIR') ?? join(process.cwd(), '..', '..', 'agents');
  }

  async onModuleInit() {
    await this.syncAll();
  }

  async syncAll() {
    const localIds = this.scanFilesystem();
    if (localIds.length === 0) {
      this.logger.log(`No local agents found in ${this.agentsDir}`);
      return;
    }

    let created = 0;
    let updated = 0;

    for (const agentId of localIds) {
      const manifest = this.loadManifest(agentId);
      if (!manifest) continue;

      const existing = await this.db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId))
        .limit(1);

      const now = new Date();

      if (existing.length === 0) {
        await this.db.insert(agents).values({
          id: manifest.id,
          name: manifest.name,
          description: manifest.description,
          icon: manifest.icon,
          color: manifest.color,
          category: manifest.category,
          tags: manifest.tags ?? [],
          latestVersion: manifest.version,
          source: 'local',
          status: 'live',
          installs: 0,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
        created++;
      } else {
        // Agent exists — update metadata from local manifest and mark as local
        await this.db
          .update(agents)
          .set({
            name: manifest.name,
            description: manifest.description,
            icon: manifest.icon,
            color: manifest.color,
            category: manifest.category,
            tags: manifest.tags ?? [],
            latestVersion: manifest.version,
            source: 'local',
            updatedAt: now,
          })
          .where(eq(agents.id, agentId));
        updated++;
      }
    }

    this.logger.log(`Local discovery: ${localIds.length} found, ${created} registered, ${updated} updated`);
  }

  /** Register a single agent by ID. Returns true if registered/updated, false if manifest not found. */
  async register(agentId: string): Promise<boolean> {
    const manifest = this.loadManifest(agentId);
    if (!manifest) return false;

    const existing = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    const now = new Date();

    if (existing.length === 0) {
      await this.db.insert(agents).values({
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        color: manifest.color,
        category: manifest.category,
        tags: manifest.tags ?? [],
        latestVersion: manifest.version,
        source: 'local',
        status: 'live',
        installs: 0,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await this.db
        .update(agents)
        .set({
          name: manifest.name,
          description: manifest.description,
          icon: manifest.icon,
          color: manifest.color,
          category: manifest.category,
          tags: manifest.tags ?? [],
          latestVersion: manifest.version,
          source: 'local',
          updatedAt: now,
        })
        .where(eq(agents.id, agentId));
    }

    this.logger.log(`Registered agent: ${agentId}`);
    return true;
  }

  private scanFilesystem(): string[] {
    try {
      return readdirSync(this.agentsDir)
        .filter((name) => {
          const dir = join(this.agentsDir, name);
          return statSync(dir).isDirectory() && existsSync(join(dir, 'manifest.json'));
        });
    } catch {
      return [];
    }
  }

  private loadManifest(agentId: string): LocalManifest | null {
    try {
      const raw = readFileSync(join(this.agentsDir, agentId, 'manifest.json'), 'utf-8');
      return JSON.parse(raw);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to load manifest for ${agentId}: ${message}`);
      return null;
    }
  }
}
