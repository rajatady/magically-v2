import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDB, type DrizzleDB } from '../db';
import { userConfig } from '../db/schema';

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

  constructor(@InjectDB() private readonly db: DrizzleDB) {}

  async onModuleInit() {
    await this.load();
  }

  private async load() {
    const rows = await this.db
      .select()
      .from(userConfig)
      .where(eq(userConfig.key, CONFIG_KEY))
      .limit(1);

    if (rows.length > 0) {
      this.config = rows[0].value as MagicallyConfig;
    }
    // Env var is a fallback only — DB value takes precedence
    if (!this.config.openrouterApiKey && process.env.OPENROUTER_API_KEY) {
      this.config.openrouterApiKey = process.env.OPENROUTER_API_KEY;
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

    const existing = await this.db
      .select()
      .from(userConfig)
      .where(eq(userConfig.key, CONFIG_KEY))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(userConfig)
        .set({ value: this.config, updatedAt: now })
        .where(eq(userConfig.key, CONFIG_KEY));
    } else {
      await this.db
        .insert(userConfig)
        .values({ key: CONFIG_KEY, value: this.config, updatedAt: now });
    }

    return this.getAll();
  }
}
