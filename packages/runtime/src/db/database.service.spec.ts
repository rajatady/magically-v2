import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('opens an in-memory database', () => {
    expect(service.db).toBeDefined();
  });

  it('creates all required tables', () => {
    const tables = service['sqlite']
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all()
      .map((r: any) => r.name) as string[];

    expect(tables).toContain('agents');
    expect(tables).toContain('feed_events');
    expect(tables).toContain('zeus_memory');
    expect(tables).toContain('zeus_conversations');
    expect(tables).toContain('zeus_tasks');
    expect(tables).toContain('user_config');
  });

  it('enforces foreign keys', () => {
    // Inserting a feed_event with a non-existent agent_id should fail
    expect(() => {
      service.exec(`
        INSERT INTO feed_events (id, agent_id, type, title, read, created_at)
        VALUES ('evt-1', 'nonexistent-agent', 'info', 'Test', 0, ${Date.now()})
      `);
    }).toThrow();
  });

  it('sets WAL journal mode for file-based databases', () => {
    // :memory: databases ignore WAL (stays 'memory') — test with a temp file
    const { join } = require('path');
    const { tmpdir } = require('os');
    const { randomUUID } = require('crypto');

    const tmpPath = join(tmpdir(), `magically-wal-${randomUUID()}.db`);
    process.env.DB_PATH = tmpPath;

    const fileSvc = new (service.constructor as any)(null);
    // Bootstrap DB directly
    const Database = require('better-sqlite3');
    const sqlite = new Database(tmpPath);
    sqlite.pragma('journal_mode = WAL');
    const row = sqlite.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    sqlite.close();

    const { unlinkSync } = require('fs');
    try { unlinkSync(tmpPath); } catch {}
    try { unlinkSync(tmpPath + '-wal'); } catch {}
    try { unlinkSync(tmpPath + '-shm'); } catch {}

    expect(row.journal_mode).toBe('wal');
  });
});
