import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DRIZZLE, type DrizzleDB } from './drizzle.provider';
import { InjectDB } from './inject-db.decorator';
import * as schema from './schema';

@Injectable()
class TestService {
  constructor(@InjectDB() public readonly db: DrizzleDB) {}
}

describe('Database (DrizzleModule)', () => {
  let service: TestService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2' });
            return drizzle(pool, { schema });
          },
        },
        TestService,
      ],
    }).compile();

    service = module.get(TestService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('connects and can query', async () => {
    const result = await service.db.execute(sql`SELECT 1 as ok`);
    expect((result as unknown as { rows: Array<{ ok: number }> }).rows[0].ok).toBe(1);
  });

  it('has all required tables', async () => {
    const result = await service.db.execute(sql`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name
    `);
    const tables = (result as unknown as { rows: Array<{ table_name: string }> }).rows.map((r) => r.table_name);
    expect(tables).toContain('agents');
    expect(tables).toContain('feed_events');
    expect(tables).toContain('zeus_memory');
    expect(tables).toContain('zeus_conversations');
    expect(tables).toContain('zeus_tasks');
    expect(tables).toContain('agent_secrets');
    expect(tables).toContain('user_config');
  });
});
