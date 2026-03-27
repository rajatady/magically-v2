import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { TriggerSchedulerService } from '../src/agents/trigger-scheduler.service';
import { FunctionRunnerService } from '../src/agents/function-runner.service';
import { AgentsService, type AgentWithManifest } from '../src/agents/agents.service';
import { DRIZZLE, type DrizzleDB } from '../src/db';
import * as schema from '../src/db/schema';
import { agents, agentVersions, agentRuns, agentSecrets, feedEvents, userAgentInstalls } from '../src/db/schema';

function makeAgent(id: string, manifest: Record<string, unknown>): AgentWithManifest {
  return {
    id,
    name: manifest.name as string,
    latestVersion: manifest.version as string,
    description: null,
    icon: null,
    color: null,
    category: null,
    status: 'live',
    enabled: true,
    manifest,
  };
}

describe('TriggerSchedulerService', () => {
  let scheduler: TriggerSchedulerService;
  let schedulerRegistry: SchedulerRegistry;
  let mockAgentsService: { findAll: jest.Mock };
  let module: TestingModule;

  beforeAll(async () => {
    mockAgentsService = {
      findAll: jest.fn().mockResolvedValue([]),
    };

    module = await Test.createTestingModule({
      providers: [
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2_test' });
            return drizzle(pool, { schema });
          },
        },
        { provide: AgentsService, useValue: mockAgentsService },
        { provide: FunctionRunnerService, useValue: { run: jest.fn() } },
        SchedulerRegistry,
        TriggerSchedulerService,
      ],
    }).compile();

    schedulerRegistry = module.get(SchedulerRegistry);
    scheduler = module.get(TriggerSchedulerService);
  });

  afterEach(() => {
    for (const name of schedulerRegistry.getCronJobs().keys()) {
      schedulerRegistry.deleteCronJob(name);
    }
  });

  afterAll(async () => {
    await module.close();
  });

  it('registers a cron job for each cron trigger', () => {
    const manifest = {
      id: 'multi-cron', name: 'Multi Cron', version: '1.0.0',
      triggers: [
        { type: 'cron', name: 'Morning check', entrypoint: 'morning', schedule: '0 7 * * *' },
        { type: 'cron', name: 'Evening sync', entrypoint: 'evening', schedule: '0 19 * * *' },
      ],
      functions: [
        { name: 'morning', description: 'Morning' },
        { name: 'evening', description: 'Evening' },
      ],
    };

    scheduler.registerAgent('multi-cron', manifest);

    const jobs = schedulerRegistry.getCronJobs();
    expect(jobs.has('agent:multi-cron:morning')).toBe(true);
    expect(jobs.has('agent:multi-cron:evening')).toBe(true);
  });

  it('does not register jobs for agents without triggers', () => {
    const manifest = {
      id: 'no-triggers', name: 'No Triggers', version: '1.0.0',
      functions: [{ name: 'manual', description: 'Manual' }],
    };

    scheduler.registerAgent('no-triggers', manifest);
    expect(schedulerRegistry.getCronJobs().size).toBe(0);
  });

  it('ignores non-cron triggers', () => {
    const manifest = {
      id: 'event-only', name: 'Event Only', version: '1.0.0',
      triggers: [
        { type: 'event', name: 'On recipe added', entrypoint: 'onRecipe', event: 'agent:recipe-book:added' },
      ],
      functions: [{ name: 'onRecipe', description: 'Handle recipe' }],
    };

    scheduler.registerAgent('event-only', manifest);
    expect(schedulerRegistry.getCronJobs().size).toBe(0);
  });

  it('unregisters all cron jobs for an agent', () => {
    const manifest = {
      id: 'removable', name: 'Removable', version: '1.0.0',
      triggers: [
        { type: 'cron', name: 'A', entrypoint: 'taskA', schedule: '0 * * * *' },
        { type: 'cron', name: 'B', entrypoint: 'taskB', schedule: '30 * * * *' },
      ],
      functions: [{ name: 'taskA', description: 'A' }, { name: 'taskB', description: 'B' }],
    };

    scheduler.registerAgent('removable', manifest);
    expect(schedulerRegistry.getCronJobs().size).toBe(2);

    scheduler.unregisterAgent('removable');
    expect(schedulerRegistry.getCronJobs().size).toBe(0);
  });

  it('registerAll picks up all agents with cron triggers', async () => {
    mockAgentsService.findAll.mockResolvedValue([
      makeAgent('cron-agent', {
        id: 'cron-agent', name: 'Cron', version: '1.0.0',
        triggers: [{ type: 'cron', name: 'Tick', entrypoint: 'tick', schedule: '*/5 * * * *' }],
        functions: [{ name: 'tick', description: 'Tick' }],
      }),
      makeAgent('no-cron', {
        id: 'no-cron', name: 'None', version: '1.0.0',
        functions: [],
      }),
    ]);

    await scheduler.registerAll();

    const jobs = schedulerRegistry.getCronJobs();
    expect(jobs.has('agent:cron-agent:tick')).toBe(true);
    expect(jobs.size).toBe(1);
  });
});
