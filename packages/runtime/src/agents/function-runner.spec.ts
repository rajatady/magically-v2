import { Test, TestingModule } from '@nestjs/testing';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FunctionRunnerService } from './function-runner.service.js';
import { AgentsService } from './agents.service.js';
import { DatabaseService } from '../db/database.service.js';
import { FeedService } from '../events/feed.service.js';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service.js';
import { agentSecrets } from '../db/schema.js';

function makeTempAgent(
  dir: string,
  id: string,
  manifest: object,
  functions?: Record<string, string>,
) {
  const agentDir = join(dir, id);
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(join(agentDir, 'manifest.json'), JSON.stringify(manifest));

  if (functions) {
    const fnDir = join(agentDir, 'functions');
    mkdirSync(fnDir, { recursive: true });
    for (const [name, code] of Object.entries(functions)) {
      writeFileSync(join(fnDir, `${name}.js`), code);
    }
  }

  return agentDir;
}

describe('FunctionRunnerService', () => {
  let runner: FunctionRunnerService;
  let agents: AgentsService;
  let dbService: DatabaseService;
  let emitter: EventEmitter2;
  let tmpDir: string;

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';
    tmpDir = join(tmpdir(), `magically-fn-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    emitter = new EventEmitter2();

    const mockLlm = {
      complete: jest.fn().mockResolvedValue('mock llm response'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        AgentsService,
        FeedService,
        FunctionRunnerService,
        { provide: LlmService, useValue: mockLlm },
        { provide: NestConfigService, useValue: { get: () => undefined } },
        { provide: EventEmitter2, useValue: emitter },
      ],
    }).compile();

    dbService = module.get(DatabaseService);
    dbService.onModuleInit();

    agents = module.get(AgentsService);
    jest.spyOn(agents as any, 'scanAgentsDir').mockImplementationOnce(() => {});
    agents.onModuleInit();

    runner = module.get(FunctionRunnerService);
  });

  afterEach(() => {
    dbService.onModuleDestroy();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executes a function that returns a value', async () => {
    makeTempAgent(tmpDir, 'adder', {
      id: 'adder',
      name: 'Adder',
      version: '1.0.0',
      functions: [{ name: 'add', description: 'Add two numbers', parameters: {} }],
    }, {
      'add': `module.exports = async function(ctx, params) { return (params.a || 0) + (params.b || 0); };`,
    });

    agents.loadAgent(join(tmpDir, 'adder'), join(tmpDir, 'adder', 'manifest.json'));

    const result = await runner.run('adder', 'add', {
      type: 'manual',
      payload: { a: 2, b: 3 },
    });

    expect(result.status).toBe('success');
    expect(result.result).toBe(5);
  });

  it('captures logs from the function', async () => {
    makeTempAgent(tmpDir, 'logger', {
      id: 'logger',
      name: 'Logger',
      version: '1.0.0',
      functions: [{ name: 'greet', description: 'Log a greeting', parameters: {} }],
    }, {
      'greet': `module.exports = async function(ctx) { ctx.log.info('hello world'); return 'done'; };`,
    });

    agents.loadAgent(join(tmpDir, 'logger'), join(tmpDir, 'logger', 'manifest.json'));

    const result = await runner.run('logger', 'greet', { type: 'manual' });

    expect(result.status).toBe('success');
    expect(result.logs.length).toBe(1);
    expect(result.logs[0].message).toBe('hello world');
    expect(result.logs[0].level).toBe('info');
  });

  it('catches errors and returns failure status', async () => {
    makeTempAgent(tmpDir, 'crasher', {
      id: 'crasher',
      name: 'Crasher',
      version: '1.0.0',
      functions: [{ name: 'boom', description: 'Throw error', parameters: {} }],
    }, {
      'boom': `module.exports = async function(ctx) { throw new Error('kaboom'); };`,
    });

    agents.loadAgent(join(tmpDir, 'crasher'), join(tmpDir, 'crasher', 'manifest.json'));

    const result = await runner.run('crasher', 'boom', { type: 'manual' });

    expect(result.status).toBe('error');
    expect(result.error).toBe('kaboom');
  });

  it('throws if function name is not declared in manifest', async () => {
    makeTempAgent(tmpDir, 'strict', {
      id: 'strict',
      name: 'Strict',
      version: '1.0.0',
      functions: [{ name: 'allowed', description: 'OK', parameters: {} }],
    }, {
      'allowed': `module.exports = async function() { return 'ok'; };`,
      'secret': `module.exports = async function() { return 'hacked'; };`,
    });

    agents.loadAgent(join(tmpDir, 'strict'), join(tmpDir, 'strict', 'manifest.json'));

    await expect(runner.run('strict', 'secret', { type: 'manual' }))
      .rejects.toThrow(/not declared/);
  });

  it('throws if function file does not exist', async () => {
    makeTempAgent(tmpDir, 'missing', {
      id: 'missing',
      name: 'Missing',
      version: '1.0.0',
      functions: [{ name: 'ghost', description: 'No file', parameters: {} }],
    });
    // No function files created

    agents.loadAgent(join(tmpDir, 'missing'), join(tmpDir, 'missing', 'manifest.json'));

    await expect(runner.run('missing', 'ghost', { type: 'manual' }))
      .rejects.toThrow(/not found/i);
  });

  it('emits feed events when function calls ctx.emit', async () => {
    const feedEvents: unknown[] = [];
    emitter.on('feed.new', (item: unknown) => feedEvents.push(item));

    makeTempAgent(tmpDir, 'poster', {
      id: 'poster',
      name: 'Poster',
      version: '1.0.0',
      functions: [{ name: 'post', description: 'Post to feed', parameters: {} }],
    }, {
      'post': `module.exports = async function(ctx) {
        ctx.emit('feed', { type: 'success', title: 'It worked!' });
        return 'posted';
      };`,
    });

    agents.loadAgent(join(tmpDir, 'poster'), join(tmpDir, 'poster', 'manifest.json'));

    await runner.run('poster', 'post', { type: 'manual' });

    expect(feedEvents.length).toBe(1);
  });

  it('provides ctx.llm.ask that calls the LLM service', async () => {
    makeTempAgent(tmpDir, 'llm-user', {
      id: 'llm-user',
      name: 'LLM User',
      version: '1.0.0',
      functions: [{ name: 'think', description: 'Use LLM', parameters: {} }],
    }, {
      'think': `module.exports = async function(ctx) {
        const answer = await ctx.llm.ask('What is 2+2?');
        return { answer };
      };`,
    });

    agents.loadAgent(join(tmpDir, 'llm-user'), join(tmpDir, 'llm-user', 'manifest.json'));

    const result = await runner.run('llm-user', 'think', { type: 'manual' });

    expect(result.status).toBe('success');
    expect((result.result as any).answer).toBe('mock llm response');
  });

  it('injects declared secrets from the database into ctx.secrets', async () => {
    makeTempAgent(tmpDir, 'secret-reader', {
      id: 'secret-reader',
      name: 'Secret Reader',
      version: '1.0.0',
      secrets: ['API_KEY', 'OTHER_KEY'],
      functions: [{ name: 'readSecret', description: 'Read secrets', parameters: {} }],
    }, {
      'readSecret': `module.exports = async function(ctx) { return ctx.secrets; };`,
    });

    agents.loadAgent(join(tmpDir, 'secret-reader'), join(tmpDir, 'secret-reader', 'manifest.json'));

    // Insert secrets into DB via Drizzle
    const now = new Date();
    dbService.db.insert(agentSecrets).values({ agentId: 'secret-reader', key: 'API_KEY', value: 'sk-12345', updatedAt: now }).run();
    dbService.db.insert(agentSecrets).values({ agentId: 'secret-reader', key: 'OTHER_KEY', value: 'other-val', updatedAt: now }).run();
    // Also insert a secret NOT declared in manifest — should NOT be injected
    dbService.db.insert(agentSecrets).values({ agentId: 'secret-reader', key: 'UNDECLARED', value: 'should-not-appear', updatedAt: now }).run();

    const result = await runner.run('secret-reader', 'readSecret', { type: 'manual' });

    expect(result.status).toBe('success');
    expect(result.result).toEqual({
      API_KEY: 'sk-12345',
      OTHER_KEY: 'other-val',
    });
    // UNDECLARED should not be present
    expect((result.result as any).UNDECLARED).toBeUndefined();
  });
});
