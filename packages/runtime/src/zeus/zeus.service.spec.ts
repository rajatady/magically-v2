import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ZeusService } from './zeus.service.js';
import { DatabaseService } from '../db/database.service.js';
import { LlmService } from '../llm/llm.service.js';
import { AgentsService } from '../agents/agents.service.js';
import { EventsGateway } from '../events/events.gateway.js';
import { ConfigService } from '../config/config.service.js';

describe('ZeusService', () => {
  let service: ZeusService;
  let db: DatabaseService;
  let llm: LlmService;
  let events: EventsGateway;

  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';

    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        DatabaseService,
        ConfigService,
        {
          provide: LlmService,
          useValue: {
            streamChat: jest.fn(),
            getDefaultModel: () => 'test-model',
          },
        },
        {
          provide: AgentsService,
          useValue: {
            findAll: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: EventsGateway,
          useValue: {
            emit: jest.fn(),
          },
        },
        ZeusService,
      ],
    }).compile();

    db = module.get<DatabaseService>(DatabaseService);
    db.onModuleInit();

    const config = module.get<ConfigService>(ConfigService);
    config.onModuleInit();

    service = module.get<ZeusService>(ZeusService);
    llm = module.get<LlmService>(LlmService);
    events = module.get<EventsGateway>(EventsGateway);
  });

  afterEach(() => db.onModuleDestroy());

  describe('createConversation', () => {
    it('creates a conversation with default chat mode', () => {
      const conv = service.createConversation();
      expect(conv.id).toBeDefined();
      expect(conv.mode).toBe('chat');
      expect(conv.messages).toEqual([]);
    });

    it('creates a conversation in build mode', () => {
      const conv = service.createConversation('build', 'my-agent');
      expect(conv.mode).toBe('build');
    });

    it('persists conversation to DB', () => {
      const { id } = service.createConversation();
      const fetched = service.getConversation(id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(id);
    });
  });

  describe('chat streaming', () => {
    it('streams response chunks and persists conversation', async () => {
      async function* fakeStream() {
        yield { content: 'Hello', done: false };
        yield { content: ' world', done: false };
        yield { content: '', done: true };
      }

      jest.spyOn(llm, 'streamChat').mockReturnValue(fakeStream() as any);

      const { id } = service.createConversation();
      const chunks: string[] = [];

      for await (const chunk of service.chat(id, 'Hi')) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' world']);

      // Conversation should be updated with user + assistant messages
      const conv = service.getConversation(id);
      const messages = conv!.messages as Array<{ role: string; content: string }>;
      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({ role: 'user', content: 'Hi' });
      expect(messages[1]).toMatchObject({ role: 'assistant', content: 'Hello world' });
    });

    it('emits zeus:typing and zeus:done events', async () => {
      async function* fakeStream() {
        yield { content: 'Done', done: true };
      }
      jest.spyOn(llm, 'streamChat').mockReturnValue(fakeStream() as any);

      const { id } = service.createConversation();
      for await (const _ of service.chat(id, 'Hello')) { /* drain */ }

      const emitCalls = (events.emit as jest.Mock).mock.calls.map((c) => c[0].type);
      expect(emitCalls).toContain('zeus:typing');
      expect(emitCalls).toContain('zeus:done');
    });

    it('throws for unknown conversation id', async () => {
      const gen = service.chat('nonexistent-id', 'Hello');
      await expect(gen.next()).rejects.toThrow();
    });
  });

  describe('memory', () => {
    it('stores and retrieves a memory entry', () => {
      service.setMemory('user.name', 'Divya', 'user', 'user');
      const entries = service.getMemory();
      const found = entries.find((e) => e.key === 'user.name');
      expect(found?.value).toBe('Divya');
    });

    it('updates an existing memory entry', () => {
      service.setMemory('pref.theme', 'dark', 'preference', 'user');
      service.setMemory('pref.theme', 'light', 'preference', 'user');

      const entries = service.getMemory();
      const themed = entries.filter((e) => e.key === 'pref.theme');
      expect(themed.length).toBe(1);
      expect(themed[0].value).toBe('light');
    });

    it('deletes a memory entry', () => {
      service.setMemory('temp.key', 'value', 'context', 'zeus');
      service.deleteMemory('temp.key');

      const entries = service.getMemory();
      expect(entries.find((e) => e.key === 'temp.key')).toBeUndefined();
    });
  });

  describe('zeus tasks', () => {
    it('creates a task with pending status', () => {
      const id = service.createTask({
        requesterId: 'calendar-hero',
        goal: 'Research attendees for 9am meeting',
        priority: 'high',
      });

      const tasks = service.getTasks();
      const task = tasks.find((t) => t.id === id);
      expect(task?.status).toBe('pending');
      expect(task?.requesterId).toBe('calendar-hero');
    });

    it('sets status to awaiting_approval when requiresApproval is true', () => {
      const id = service.createTask({
        requesterId: 'superdo',
        goal: 'Research Mateo for Monster Jam',
        requiresApproval: true,
      });

      const tasks = service.getTasks();
      const task = tasks.find((t) => t.id === id);
      expect(task?.status).toBe('awaiting_approval');
    });

    it('returns tasks sorted by createdAt descending', () => {
      // Ensure distinct timestamps by manipulating the DB directly
      const id1 = service.createTask({ requesterId: 'a', goal: 'First task' });
      const id2 = service.createTask({ requesterId: 'b', goal: 'Second task' });

      // Bump id2's created_at to be later
      db['sqlite'].prepare(
        `UPDATE zeus_tasks SET created_at = created_at + 1000 WHERE id = ?`
      ).run(id2);

      const tasks = service.getTasks();
      expect(tasks[0].goal).toBe('Second task');
      expect(tasks[1].goal).toBe('First task');
    });
  });
});
