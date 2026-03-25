import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AgentsService } from './agents.service.js';
import { DatabaseService } from '../db/database.service.js';

function makeTempAgent(dir: string, id: string, manifest: object) {
  const agentDir = join(dir, id);
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, 'manifest.json'), JSON.stringify(manifest));
  return agentDir;
}

describe('AgentsService', () => {
  let service: AgentsService;
  let dbService: DatabaseService;
  let tmpDir: string;

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';
    tmpDir = join(tmpdir(), `magically-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService, AgentsService],
    }).compile();

    dbService = module.get<DatabaseService>(DatabaseService);
    dbService.onModuleInit();

    service = module.get<AgentsService>(AgentsService);
    // Prevent auto-scan by pointing to a non-existent path
    jest.spyOn(service as any, 'scanAgentsDir').mockImplementationOnce(() => {});
    service.onModuleInit();
  });

  afterEach(() => {
    dbService.onModuleDestroy();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('loadAgent', () => {
    it('loads a valid manifest and stores in memory + DB', () => {
      makeTempAgent(tmpDir, 'test-agent', {
        id: 'test-agent',
        name: 'Test Agent',
        version: '1.0.0',
        description: 'A test agent',
      });

      const agentDir = join(tmpDir, 'test-agent');
      const inst = service.loadAgent(agentDir, join(agentDir, 'manifest.json'));

      expect(inst.manifest.id).toBe('test-agent');
      expect(inst.manifest.name).toBe('Test Agent');
      expect(inst.enabled).toBe(true);
    });

    it('rejects an invalid manifest (missing required fields)', () => {
      makeTempAgent(tmpDir, 'bad-agent', { name: 'No ID' });
      const agentDir = join(tmpDir, 'bad-agent');

      expect(() =>
        service.loadAgent(agentDir, join(agentDir, 'manifest.json')),
      ).toThrow();
    });

    it('rejects agent ids with uppercase or spaces', () => {
      makeTempAgent(tmpDir, 'Bad Agent', {
        id: 'Bad Agent',
        name: 'Bad',
        version: '1.0.0',
      });
      const agentDir = join(tmpDir, 'Bad Agent');

      expect(() =>
        service.loadAgent(agentDir, join(agentDir, 'manifest.json')),
      ).toThrow();
    });
  });

  describe('findAll / findOne', () => {
    beforeEach(() => {
      makeTempAgent(tmpDir, 'agent-a', {
        id: 'agent-a',
        name: 'Agent A',
        version: '1.0.0',
      });
      service.loadAgent(
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
    beforeEach(() => {
      makeTempAgent(tmpDir, 'toggle-agent', {
        id: 'toggle-agent',
        name: 'Toggle',
        version: '1.0.0',
      });
      service.loadAgent(
        join(tmpDir, 'toggle-agent'),
        join(tmpDir, 'toggle-agent', 'manifest.json'),
      );
    });

    it('disables and re-enables an agent', () => {
      service.disable('toggle-agent');
      expect(service.findOne('toggle-agent').enabled).toBe(false);

      service.enable('toggle-agent');
      expect(service.findOne('toggle-agent').enabled).toBe(true);
    });
  });

  describe('scanAgentsDir', () => {
    it('skips non-existent directories gracefully', () => {
      expect(() =>
        service.scanAgentsDir('/nonexistent/path/abc123'),
      ).not.toThrow();
    });

    it('loads multiple agents from a directory', () => {
      makeTempAgent(tmpDir, 'scan-a', { id: 'scan-a', name: 'A', version: '1.0.0' });
      makeTempAgent(tmpDir, 'scan-b', { id: 'scan-b', name: 'B', version: '1.0.0' });

      service.scanAgentsDir(tmpDir);

      const all = service.findAll();
      const ids = all.map((a) => a.manifest.id);
      expect(ids).toContain('scan-a');
      expect(ids).toContain('scan-b');
    });
  });
});
