import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { DRIZZLE, DrizzleDB } from '../db';
import { RegistryService } from './registry.service';
import { StorageService } from './storage.service';
import * as schema from '../db/schema';
import { users, agents, registryVersions, userAgentInstalls, agentSecrets, agentRuns, feedEvents } from '../db/schema';

describe('RegistryService', () => {
  let service: RegistryService;
  let db: DrizzleDB;
  let module: TestingModule;
  let mockQueue: { add: jest.Mock };
  const testUserId = 'test-user-registry';

  beforeAll(async () => {
    const mockStorage: Partial<StorageService> = {
      uploadBundle: jest.fn().mockResolvedValue('https://storage.example.com/bundle.tar.gz'),
    };

    mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    module = await Test.createTestingModule({
      providers: [
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2' });
            return drizzle(pool, { schema });
          },
        },
        RegistryService,
        { provide: StorageService, useValue: mockStorage },
        { provide: getQueueToken('agent-build'), useValue: mockQueue },
      ],
    }).compile();

    db = module.get(DRIZZLE);
    service = module.get(RegistryService);

    // Seed a test user
    await db.delete(userAgentInstalls);
    await db.delete(agentRuns);
    await db.delete(agentSecrets);
    await db.delete(feedEvents);
    await db.delete(registryVersions);
    await db.delete(agents);
    await db.insert(users).values({
      id: testUserId,
      email: 'test@registry.com',
      name: 'Test User',
      provider: 'local',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).onConflictDoNothing();
  });

  beforeEach(async () => {
    await db.delete(userAgentInstalls);
    await db.delete(agentRuns);
    await db.delete(agentSecrets);
    await db.delete(feedEvents);
    await db.delete(registryVersions);
    await db.delete(agents);
    mockQueue.add.mockClear();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('publish', () => {
    it('publishes a new agent to the registry', async () => {
      const manifest = {
        id: 'test-agent',
        name: 'Test Agent',
        version: '1.0.0',
        description: 'A test agent',
        functions: [],
      };

      const result = await service.publish(testUserId, manifest);

      expect(result.agentId).toBe('test-agent');
      expect(result.version).toBe('1.0.0');
      expect(result.status).toBe('live');
    });

    it('publishes a new version of an existing agent', async () => {
      const v1 = { id: 'versioned', name: 'V', version: '1.0.0', functions: [] };
      const v2 = { id: 'versioned', name: 'V', version: '2.0.0', functions: [] };

      await service.publish(testUserId, v1);
      const result = await service.publish(testUserId, v2);

      expect(result.version).toBe('2.0.0');

      const agent = await service.getAgent('versioned');
      expect(agent?.latestVersion).toBe('2.0.0');
    });

    it('returns status processing and enqueues build for container agents with bundle', async () => {
      const manifest = {
        id: 'container-agent',
        name: 'Container Agent',
        version: '1.0.0',
        runtime: { base: 'python:3.12-slim', system: [], install: 'pip install requests' },
        functions: [],
      };

      const bundle = Buffer.from('fake-tar-gz');
      const result = await service.publish(testUserId, manifest, bundle);

      expect(result.status).toBe('processing');
      expect(result.versionId).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'build-container-agent-1.0.0',
        expect.objectContaining({
          agentId: 'container-agent',
          version: '1.0.0',
          versionId: result.versionId,
        }),
        expect.objectContaining({ attempts: 3 }),
      );
    });

    it('returns status live for lightweight agents (no runtime block)', async () => {
      const manifest = {
        id: 'light-agent',
        name: 'Light Agent',
        version: '1.0.0',
        functions: [],
      };

      const result = await service.publish(testUserId, manifest);
      expect(result.status).toBe('live');
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('rejects publishing by a different author', async () => {
      const manifest = { id: 'owned', name: 'Owned', version: '1.0.0', functions: [] };
      await service.publish(testUserId, manifest);

      await expect(
        service.publish('other-user', { ...manifest, version: '2.0.0' }),
      ).rejects.toThrow(/not the author/i);
    });
  });

  describe('list and search', () => {
    beforeEach(async () => {
      await service.publish(testUserId, {
        id: 'alpha', name: 'Alpha', version: '1.0.0',
        description: 'First agent', category: 'social', tags: ['instagram'],
        functions: [],
      });
      await service.publish(testUserId, {
        id: 'beta', name: 'Beta', version: '1.0.0',
        description: 'Second agent', category: 'productivity', tags: ['todo'],
        functions: [],
      });
    });

    it('lists all live agents', async () => {
      const agents = await service.listAgents();
      expect(agents.length).toBe(2);
    });

    it('filters by category', async () => {
      const agents = await service.listAgents({ category: 'social' });
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe('alpha');
    });

    it('searches by name', async () => {
      const agents = await service.listAgents({ search: 'beta' });
      expect(agents.length).toBe(1);
      expect(agents[0].id).toBe('beta');
    });
  });

  describe('install', () => {
    beforeEach(async () => {
      await service.publish(testUserId, {
        id: 'installable', name: 'Installable', version: '1.0.0',
        config: { apiKey: { type: 'string', label: 'API Key', required: true } },
        functions: [],
      });
    });

    it('installs an agent for a user', async () => {
      const install = await service.install(testUserId, 'installable');

      expect(install.agentId).toBe('installable');
      expect(install.userId).toBe(testUserId);
      expect(install.version).toBe('1.0.0');
      expect(install.enabled).toBe(true);
    });

    it('rejects installing a non-existent agent', async () => {
      await expect(
        service.install(testUserId, 'ghost'),
      ).rejects.toThrow(/not found/i);
    });

    it('rejects duplicate install', async () => {
      await service.install(testUserId, 'installable');

      await expect(
        service.install(testUserId, 'installable'),
      ).rejects.toThrow(/already installed/i);
    });
  });

  describe('getInstall and updateConfig', () => {
    beforeEach(async () => {
      await service.publish(testUserId, {
        id: 'configurable', name: 'Configurable', version: '1.0.0',
        config: { theme: { type: 'string', label: 'Theme', default: 'dark' } },
        functions: [],
      });
      await service.install(testUserId, 'configurable');
    });

    it('retrieves a user install', async () => {
      const install = await service.getInstall(testUserId, 'configurable');
      expect(install).not.toBeNull();
      expect(install!.agentId).toBe('configurable');
    });

    it('updates user config for an installed agent', async () => {
      await service.updateConfig(testUserId, 'configurable', { theme: 'light' });

      const install = await service.getInstall(testUserId, 'configurable');
      expect(install!.config).toEqual({ theme: 'light' });
    });
  });

  describe('uninstall', () => {
    it('removes an installed agent', async () => {
      await service.publish(testUserId, {
        id: 'removable', name: 'Removable', version: '1.0.0', functions: [],
      });
      await service.install(testUserId, 'removable');
      await service.uninstall(testUserId, 'removable');

      const install = await service.getInstall(testUserId, 'removable');
      expect(install).toBeNull();
    });
  });
});
