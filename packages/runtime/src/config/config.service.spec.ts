import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service.js';
import { DatabaseService } from '../db/database.service.js';

describe('ConfigService', () => {
  let service: ConfigService;
  let db: DatabaseService;

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService, ConfigService],
    }).compile();

    db = module.get<DatabaseService>(DatabaseService);
    db.onModuleInit();

    service = module.get<ConfigService>(ConfigService);
    service.onModuleInit();
  });

  afterEach(() => {
    db.onModuleDestroy();
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
