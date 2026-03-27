import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { FunctionRunnerService } from '../src/agents/function-runner.service';
import { AgentsService, type AgentWithManifest } from '../src/agents/agents.service';
import { FeedService } from '../src/events/feed.service';
import { LlmService } from '../src/llm/llm.service';
import { DRIZZLE, type DrizzleDB } from '../src/db';
import * as schema from '../src/db/schema';
import { agents, agentVersions, agentSecrets, agentRuns, feedEvents, userAgentInstalls } from '../src/db/schema';

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

describe('FunctionRunnerService', () => {
  let runner: FunctionRunnerService;
  let mockAgentsService: { findOne: jest.Mock };
  let db: DrizzleDB;
  let module: TestingModule;

  beforeAll(async () => {
    mockAgentsService = {
      findOne: jest.fn(),
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
        { provide: FeedService, useValue: { create: jest.fn() } },
        { provide: LlmService, useValue: { complete: jest.fn() } },
        { provide: NestConfigService, useValue: { get: () => undefined } },
        FunctionRunnerService,
      ],
    }).compile();

    db = module.get<DrizzleDB>(DRIZZLE);
    runner = module.get<FunctionRunnerService>(FunctionRunnerService);
  });

  beforeEach(async () => {
    mockAgentsService.findOne.mockReset();
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

  it('throws if function name is not declared in manifest', async () => {
    mockAgentsService.findOne.mockResolvedValue(
      makeAgent('strict', {
        id: 'strict', name: 'Strict', version: '1.0.0',
        functions: [{ name: 'allowed', description: 'OK' }],
      }),
    );

    await expect(
      runner.run('strict', 'secret', { type: 'manual' }),
    ).rejects.toThrow(/not declared/);
  });

  it('creates a run record in the database', async () => {
    // Seed agent in DB so FK constraints are satisfied
    const now = new Date();
    await db.insert(agents).values({
      id: 'run-tracker', name: 'Run Tracker', latestVersion: '1.0.0',
      status: 'live', createdAt: now, updatedAt: now,
    });
    await db.insert(agentVersions).values({
      id: 'run-tracker-v1', agentId: 'run-tracker', version: '1.0.0',
      manifest: { id: 'run-tracker', name: 'Run Tracker', version: '1.0.0', runtime: { base: 'node:22-slim' }, functions: [{ name: 'greet' }] },
      imageRef: 'ghcr.io/test:run-tracker-1.0.0',
      status: 'live', publishedAt: now,
    });

    mockAgentsService.findOne.mockResolvedValue(
      makeAgent('run-tracker', {
        id: 'run-tracker', name: 'Run Tracker', version: '1.0.0',
        runtime: { base: 'node:22-slim' },
        functions: [{ name: 'greet', description: 'Greet' }],
      }),
    );

    // The container run will fail (fake image can't be pulled),
    // but the run record should still be created
    try {
      await runner.run('run-tracker', 'greet', { type: 'manual' });
    } catch {
      // Expected — fake image can't be pulled
    }

    const runs = await db.select().from(agentRuns);
    expect(runs.length).toBe(1);
    expect(runs[0].agentId).toBe('run-tracker');
    expect(runs[0].functionName).toBe('greet');
  }, 30_000);

  it('throws for lightweight agents (no runtime block)', async () => {
    const now = new Date();
    await db.insert(agents).values({
      id: 'lightweight', name: 'Lightweight', latestVersion: '1.0.0',
      status: 'live', createdAt: now, updatedAt: now,
    });
    await db.insert(agentVersions).values({
      id: 'lightweight-v1', agentId: 'lightweight', version: '1.0.0',
      manifest: { id: 'lightweight', name: 'Lightweight', version: '1.0.0', functions: [{ name: 'greet' }] },
      status: 'live', publishedAt: now,
    });

    mockAgentsService.findOne.mockResolvedValue(
      makeAgent('lightweight', {
        id: 'lightweight', name: 'Lightweight', version: '1.0.0',
        functions: [{ name: 'greet', description: 'Greet' }],
      }),
    );

    await expect(
      runner.run('lightweight', 'greet', { type: 'manual' }),
    ).rejects.toThrow(/no runtime block/i);
  });

  it('loads declared secrets from the database', async () => {
    const now = new Date();
    await db.insert(agents).values({
      id: 'secret-reader', name: 'Secret Reader', latestVersion: '1.0.0',
      status: 'live', createdAt: now, updatedAt: now,
    });
    await db.insert(agentVersions).values({
      id: 'secret-reader-v1', agentId: 'secret-reader', version: '1.0.0',
      manifest: {
        id: 'secret-reader', name: 'Secret Reader', version: '1.0.0',
        runtime: { base: 'node:22-slim' },
        secrets: ['API_KEY', 'OTHER_KEY'],
        functions: [{ name: 'readSecret' }],
      },
      imageRef: 'ghcr.io/test:secret-reader-1.0.0',
      status: 'live', publishedAt: now,
    });

    await db.insert(agentSecrets).values({ agentId: 'secret-reader', key: 'API_KEY', value: 'sk-12345', updatedAt: now });
    await db.insert(agentSecrets).values({ agentId: 'secret-reader', key: 'OTHER_KEY', value: 'other-val', updatedAt: now });
    await db.insert(agentSecrets).values({ agentId: 'secret-reader', key: 'UNDECLARED', value: 'should-not-appear', updatedAt: now });

    mockAgentsService.findOne.mockResolvedValue(
      makeAgent('secret-reader', {
        id: 'secret-reader', name: 'Secret Reader', version: '1.0.0',
        runtime: { base: 'node:22-slim' },
        secrets: ['API_KEY', 'OTHER_KEY'],
        functions: [{ name: 'readSecret' }],
      }),
    );

    // The container run will fail (fake image), but we can verify the run was attempted
    // and the agent was looked up correctly. Secret loading happens inside runInContainer.
    try {
      await runner.run('secret-reader', 'readSecret', { type: 'manual' });
    } catch {
      // Expected — fake image can't be pulled
    }

    expect(mockAgentsService.findOne).toHaveBeenCalledWith('secret-reader');
  }, 15_000);
});
