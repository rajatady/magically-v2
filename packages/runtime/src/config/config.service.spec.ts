import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ConfigService } from './config.service';
import { DRIZZLE, type DrizzleDB } from '../db';
import * as schema from '../db/schema';
import { userConfig } from '../db/schema';
import { eq } from 'drizzle-orm';

describe('ConfigService', () => {
  let service: ConfigService;
  let db: DrizzleDB;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2' });
            return drizzle(pool, { schema });
          },
        },
        ConfigService,
      ],
    }).compile();

    db = module.get<DrizzleDB>(DRIZZLE);
    await db.delete(userConfig);

    service = module.get<ConfigService>(ConfigService);
    await service.onModuleInit();
  });

  it('returns undefined for unconfigured keys', () => {
    expect(service.get('openrouterApiKey')).toBeUndefined();
  });

  it('persists config updates', async () => {
    await service.update({ openrouterApiKey: 'sk-test-123', defaultModel: 'anthropic/claude-opus-4' });

    expect(service.get('openrouterApiKey')).toBe('sk-test-123');
    expect(service.get('defaultModel')).toBe('anthropic/claude-opus-4');
  });

  it('merges partial updates without losing existing keys', async () => {
    await service.update({ openrouterApiKey: 'sk-test', theme: 'dark' });
    await service.update({ zeusName: 'Aria' });

    expect(service.get('openrouterApiKey')).toBe('sk-test');
    expect(service.get('theme')).toBe('dark');
    expect(service.get('zeusName')).toBe('Aria');
  });

  it('getAll returns a copy, not the internal reference', async () => {
    await service.update({ theme: 'dark' });
    const all = service.getAll();
    all.theme = 'light'; // mutate the copy

    expect(service.get('theme')).toBe('dark'); // original unchanged
  });
});
