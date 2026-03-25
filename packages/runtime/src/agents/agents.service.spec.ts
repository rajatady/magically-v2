import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { AgentsService } from './agents.service';
import { DRIZZLE, type DrizzleDB } from '../db';
import * as schema from '../db/schema';
import { agents } from '../db/schema';

function makeTempAgent(dir: string, id: string, manifest: object) {
  const agentDir = join(dir, id);
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, 'manifest.json'), JSON.stringify(manifest));
  return agentDir;
}

describe('AgentsService', () => {
  let service: AgentsService;
  let db: DrizzleDB;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `magically-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2' });
            return drizzle(pool, { schema });
          },
        },
        AgentsService,
      ],
    }).compile();

    db = module.get<DrizzleDB>(DRIZZLE);

    service = module.get<AgentsService>(AgentsService);
    // Prevent auto-scan by pointing to a non-existent path
    jest.spyOn(service as any, 'scanAgentsDir').mockImplementationOnce(() => {});
    await service.onModuleInit();

    // Clean up agents table before each test
    await db.delete(agents);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadAgent', () => {
    it('loads a valid manifest and stores in memory + DB', async () => {
      makeTempAgent(tmpDir, 'test-agent', {
        id: 'test-agent',
        name: 'Test Agent',
        version: '1.0.0',
        description: 'A test agent',
      });

      const agentDir = join(tmpDir, 'test-agent');
      const inst = await service.loadAgent(agentDir, join(agentDir, 'manifest.json'));

      expect(inst.manifest.id).toBe('test-agent');
      expect(inst.manifest.name).toBe('Test Agent');
      expect(inst.enabled).toBe(true);
    });

    it('rejects an invalid manifest (missing required fields)', async () => {
      makeTempAgent(tmpDir, 'bad-agent', { name: 'No ID' });
      const agentDir = join(tmpDir, 'bad-agent');

      await expect(
        service.loadAgent(agentDir, join(agentDir, 'manifest.json')),
      ).rejects.toThrow();
    });

    it('rejects agent ids with uppercase or spaces', async () => {
      makeTempAgent(tmpDir, 'Bad Agent', {
        id: 'Bad Agent',
        name: 'Bad',
        version: '1.0.0',
      });
      const agentDir = join(tmpDir, 'Bad Agent');

      await expect(
        service.loadAgent(agentDir, join(agentDir, 'manifest.json')),
      ).rejects.toThrow();
    });
  });

  describe('findAll / findOne', () => {
    beforeEach(async () => {
      makeTempAgent(tmpDir, 'agent-a', {
        id: 'agent-a',
        name: 'Agent A',
        version: '1.0.0',
      });
      await service.loadAgent(
        join(tmpDir, 'agent-a'),
        join(tmpDir, 'agent-a', 'manifest.json'),
      );
    });

    it('findAll returns loaded agents', () => {
      const all = service.findAll();
      expect(all.length).toBe(1);
      expect(all[0].manifest.id).toBe('agent-a');
    });

    it('findOne returns the agent by id', () => {
      const inst = service.findOne('agent-a');
      expect(inst.manifest.name).toBe('Agent A');
    });

    it('findOne throws NotFoundException for unknown id', () => {
      expect(() => service.findOne('ghost')).toThrow(NotFoundException);
    });
  });

  describe('enable / disable', () => {
    beforeEach(async () => {
      makeTempAgent(tmpDir, 'toggle-agent', {
        id: 'toggle-agent',
        name: 'Toggle',
        version: '1.0.0',
      });
      await service.loadAgent(
        join(tmpDir, 'toggle-agent'),
        join(tmpDir, 'toggle-agent', 'manifest.json'),
      );
    });

    it('disables and re-enables an agent', async () => {
      await service.disable('toggle-agent');
      expect(service.findOne('toggle-agent').enabled).toBe(false);

      await service.enable('toggle-agent');
      expect(service.findOne('toggle-agent').enabled).toBe(true);
    });
  });

  describe('scanAgentsDir', () => {
    it('skips non-existent directories gracefully', async () => {
      await expect(
        service.scanAgentsDir('/nonexistent/path/abc123'),
      ).resolves.not.toThrow();
    });

    it('loads multiple agents from a directory', async () => {
      makeTempAgent(tmpDir, 'scan-a', { id: 'scan-a', name: 'A', version: '1.0.0' });
      makeTempAgent(tmpDir, 'scan-b', { id: 'scan-b', name: 'B', version: '1.0.0' });

      await service.scanAgentsDir(tmpDir);

      const all = service.findAll();
      const ids = all.map((a) => a.manifest.id);
      expect(ids).toContain('scan-a');
      expect(ids).toContain('scan-b');
    });
  });
});
