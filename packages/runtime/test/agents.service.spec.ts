import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { AgentsService } from '../src/agents/agents.service';
import { DRIZZLE, type DrizzleDB } from '../src/db';
import * as schema from '../src/db/schema';
import { agents, agentVersions, agentRuns, agentSecrets, feedEvents, userAgentInstalls } from '../src/db/schema';

describe('AgentsService', () => {
  let service: AgentsService;
  let db: DrizzleDB;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2_test' });
            return drizzle(pool, { schema });
          },
        },
        AgentsService,
      ],
    }).compile();

    db = module.get<DrizzleDB>(DRIZZLE);
    service = module.get<AgentsService>(AgentsService);
  });

  beforeEach(async () => {
    await db.delete(userAgentInstalls);
    await db.delete(agentRuns);
    await db.delete(agentSecrets);
    await db.delete(feedEvents);
    await db.delete(agentVersions);
    await db.delete(agents);
  });

  afterAll(async () => {
    await module.close();
  });

  async function seedAgent(id: string, name: string, manifest: Record<string, unknown>, opts?: { enabled?: boolean; status?: string }) {
    const now = new Date();
    await db.insert(agents).values({
      id,
      name,
      description: (manifest.description as string) ?? null,
      latestVersion: manifest.version as string,
      status: opts?.status ?? 'live',
      enabled: opts?.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(agentVersions).values({
      id: `${id}-v-${manifest.version}`,
      agentId: id,
      version: manifest.version as string,
      manifest,
      status: 'live',
      publishedAt: now,
    });
  }

  describe('findAll', () => {
    it('returns all live agents with manifests', async () => {
      await seedAgent('agent-a', 'Agent A', { id: 'agent-a', name: 'Agent A', version: '1.0.0' });
      await seedAgent('agent-b', 'Agent B', { id: 'agent-b', name: 'Agent B', version: '2.0.0' });

      const all = await service.findAll();
      expect(all.length).toBe(2);
      const ids = all.map((a) => a.id);
      expect(ids).toContain('agent-a');
      expect(ids).toContain('agent-b');
    });

    it('excludes non-live agents', async () => {
      await seedAgent('live-agent', 'Live', { id: 'live-agent', name: 'Live', version: '1.0.0' });
      await seedAgent('draft-agent', 'Draft', { id: 'draft-agent', name: 'Draft', version: '1.0.0' }, { status: 'draft' });

      const all = await service.findAll();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe('live-agent');
    });

    it('returns manifest from the latest live version', async () => {
      await seedAgent('versioned', 'Versioned', {
        id: 'versioned', name: 'Versioned', version: '1.0.0',
        functions: [{ name: 'greet', description: 'Greet' }],
      });

      const all = await service.findAll();
      const agent = all.find((a) => a.id === 'versioned');
      expect(agent?.manifest.functions).toEqual([{ name: 'greet', description: 'Greet' }]);
    });
  });

  describe('findOne', () => {
    it('returns the agent by id', async () => {
      await seedAgent('test-agent', 'Test Agent', { id: 'test-agent', name: 'Test Agent', version: '1.0.0' });

      const agent = await service.findOne('test-agent');
      expect(agent.id).toBe('test-agent');
      expect(agent.name).toBe('Test Agent');
      expect(agent.manifest.version).toBe('1.0.0');
    });

    it('throws NotFoundException for unknown id', async () => {
      await expect(service.findOne('ghost')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for agent with no live version', async () => {
      const now = new Date();
      await db.insert(agents).values({
        id: 'no-version', name: 'No Version', latestVersion: '1.0.0',
        status: 'live', createdAt: now, updatedAt: now,
      });

      await expect(service.findOne('no-version')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getManifest', () => {
    it('returns the manifest for an agent', async () => {
      const manifest = { id: 'manifest-agent', name: 'Manifest', version: '1.0.0', secrets: ['API_KEY'] };
      await seedAgent('manifest-agent', 'Manifest', manifest);

      const result = await service.getManifest('manifest-agent');
      expect(result.secrets).toEqual(['API_KEY']);
    });
  });

  describe('enable / disable', () => {
    it('disables and re-enables an agent', async () => {
      await seedAgent('toggle-agent', 'Toggle', { id: 'toggle-agent', name: 'Toggle', version: '1.0.0' });

      await service.disable('toggle-agent');
      const disabled = await service.findOne('toggle-agent');
      expect(disabled.enabled).toBe(false);

      await service.enable('toggle-agent');
      const enabled = await service.findOne('toggle-agent');
      expect(enabled.enabled).toBe(true);
    });
  });
});
