import { Test, TestingModule } from '@nestjs/testing';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { TriggerSchedulerService } from './trigger-scheduler.service';
import { FunctionRunnerService } from './function-runner.service';
import { AgentsService } from './agents.service';
import { FeedService } from '../events/feed.service';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { DRIZZLE } from '../db/drizzle.provider';
import * as schema from '../db/schema';

function makeTempAgent(
  dir: string,
  id: string,
  manifest: object,
  functions?: Record<string, string>,
) {
  const agentDir = join(dir, id);
  mkdirSync(join(agentDir, 'functions'), { recursive: true });
  writeFileSync(join(agentDir, 'manifest.json'), JSON.stringify(manifest));
  if (functions) {
    for (const [name, code] of Object.entries(functions)) {
      writeFileSync(join(agentDir, 'functions', `${name}.js`), code);
    }
  }
  return agentDir;
}

describe('TriggerSchedulerService', () => {
  let scheduler: TriggerSchedulerService;
  let agents: AgentsService;
  let schedulerRegistry: SchedulerRegistry;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `magically-sched-test-${Date.now()}`);
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
        FeedService,
        FunctionRunnerService,
        TriggerSchedulerService,
        SchedulerRegistry,
        { provide: LlmService, useValue: { complete: jest.fn() } },
        { provide: NestConfigService, useValue: { get: () => undefined } },
        { provide: EventEmitter2, useValue: new EventEmitter2() },
      ],
    }).compile();

    agents = module.get(AgentsService);
    jest.spyOn(agents as any, 'scanAgentsDir').mockImplementationOnce(() => {});
    await agents.onModuleInit();

    schedulerRegistry = module.get(SchedulerRegistry);
    scheduler = module.get(TriggerSchedulerService);
  });

  afterEach(() => {
    for (const name of schedulerRegistry.getCronJobs().keys()) {
      schedulerRegistry.deleteCronJob(name);
    }
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('registers a cron job for each cron trigger', () => {
    makeTempAgent(tmpDir, 'multi-cron', {
      id: 'multi-cron',
      name: 'Multi Cron',
      version: '1.0.0',
      triggers: [
        { type: 'cron', name: 'Morning check', entrypoint: 'morning', schedule: '0 7 * * *' },
        { type: 'cron', name: 'Evening sync', entrypoint: 'evening', schedule: '0 19 * * *' },
      ],
      functions: [
        { name: 'morning', description: 'Morning', parameters: {} },
        { name: 'evening', description: 'Evening', parameters: {} },
      ],
    }, {
      'morning': `module.exports = async function() { return 'gm'; };`,
      'evening': `module.exports = async function() { return 'gn'; };`,
    });

    agents.loadAgent(join(tmpDir, 'multi-cron'), join(tmpDir, 'multi-cron', 'manifest.json'));
    scheduler.registerAgent('multi-cron');

    const jobs = schedulerRegistry.getCronJobs();
    expect(jobs.has('agent:multi-cron:morning')).toBe(true);
    expect(jobs.has('agent:multi-cron:evening')).toBe(true);
  });

  it('does not register jobs for agents without triggers', () => {
    makeTempAgent(tmpDir, 'no-triggers', {
      id: 'no-triggers',
      name: 'No Triggers',
      version: '1.0.0',
      functions: [{ name: 'manual', description: 'Manual', parameters: {} }],
    }, {
      'manual': `module.exports = async function() { return 'done'; };`,
    });

    agents.loadAgent(join(tmpDir, 'no-triggers'), join(tmpDir, 'no-triggers', 'manifest.json'));
    scheduler.registerAgent('no-triggers');

    expect(schedulerRegistry.getCronJobs().size).toBe(0);
  });

  it('ignores non-cron triggers', () => {
    makeTempAgent(tmpDir, 'event-only', {
      id: 'event-only',
      name: 'Event Only',
      version: '1.0.0',
      triggers: [
        { type: 'event', name: 'On recipe added', entrypoint: 'onRecipe', event: 'agent:recipe-book:added' },
      ],
      functions: [
        { name: 'onRecipe', description: 'Handle recipe', parameters: {} },
      ],
    }, {
      'onRecipe': `module.exports = async function() {};`,
    });

    agents.loadAgent(join(tmpDir, 'event-only'), join(tmpDir, 'event-only', 'manifest.json'));
    scheduler.registerAgent('event-only');

    expect(schedulerRegistry.getCronJobs().size).toBe(0);
  });

  it('unregisters all cron jobs for an agent', () => {
    makeTempAgent(tmpDir, 'removable', {
      id: 'removable',
      name: 'Removable',
      version: '1.0.0',
      triggers: [
        { type: 'cron', name: 'A', entrypoint: 'taskA', schedule: '0 * * * *' },
        { type: 'cron', name: 'B', entrypoint: 'taskB', schedule: '30 * * * *' },
      ],
      functions: [
        { name: 'taskA', description: 'A', parameters: {} },
        { name: 'taskB', description: 'B', parameters: {} },
      ],
    }, {
      'taskA': `module.exports = async function() {};`,
      'taskB': `module.exports = async function() {};`,
    });

    agents.loadAgent(join(tmpDir, 'removable'), join(tmpDir, 'removable', 'manifest.json'));
    scheduler.registerAgent('removable');

    expect(schedulerRegistry.getCronJobs().size).toBe(2);

    scheduler.unregisterAgent('removable');
    expect(schedulerRegistry.getCronJobs().size).toBe(0);
  });

  it('registerAll picks up all agents with cron triggers', async () => {
    makeTempAgent(tmpDir, 'cron-agent', {
      id: 'cron-agent',
      name: 'Cron',
      version: '1.0.0',
      triggers: [
        { type: 'cron', name: 'Tick', entrypoint: 'tick', schedule: '*/5 * * * *' },
      ],
      functions: [{ name: 'tick', description: 'Tick', parameters: {} }],
    }, {
      'tick': `module.exports = async function() {};`,
    });
    makeTempAgent(tmpDir, 'no-cron', {
      id: 'no-cron',
      name: 'None',
      version: '1.0.0',
      functions: [],
    });

    await agents.scanAgentsDir(tmpDir);
    scheduler.registerAll();

    const jobs = schedulerRegistry.getCronJobs();
    expect(jobs.has('agent:cron-agent:tick')).toBe(true);
    expect(jobs.size).toBe(1);
  });
});
