import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../db/database.service.js';
import { userConfig } from '../db/schema.js';

export interface MagicallyConfig {
  openrouterApiKey?: string;
  defaultModel?: string;
  zeusName?: string;
  zeusPersonality?: string;
  theme?: 'dark' | 'light' | 'auto';
  accentColor?: string;
}

const CONFIG_KEY = 'magically_config';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private config: MagicallyConfig = {};

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    this.load();
  }

  private load() {
    const row = this.db.db
      .select()
      .from(userConfig)
      .where(eq(userConfig.key, CONFIG_KEY))
      .get();

    if (row) {
      this.config = row.value as MagicallyConfig;
    }
    this.logger.log('Config loaded');
  }

  get<K extends keyof MagicallyConfig>(key: K): MagicallyConfig[K] {
    return this.config[key];
  }

  getAll(): MagicallyConfig {
    return { ...this.config };
  }

  async update(partial: Partial<MagicallyConfig>): Promise<MagicallyConfig> {
    this.config = { ...this.config, ...partial };
    const now = new Date();

    const existing = this.db.db
      .select()
      .from(userConfig)
      .where(eq(userConfig.key, CONFIG_KEY))
      .get();

    if (existing) {
      this.db.db
        .update(userConfig)
        .set({ value: this.config, updatedAt: now })
        .where(eq(userConfig.key, CONFIG_KEY))
        .run();
    } else {
      this.db.db
        .insert(userConfig)
        .values({ key: CONFIG_KEY, value: this.config, updatedAt: now })
        .run();
    }

    return this.getAll();
  }
}
