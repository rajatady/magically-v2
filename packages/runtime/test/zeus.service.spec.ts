import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
// AI SDK test imports removed — streamChat was replaced by Agent SDK runPrompt
import { ZeusService } from '../src/zeus/zeus.service';
import { LlmService } from '../src/llm/llm.service';
import { AgentsService } from '../src/agents/agents.service';
import { EventsGateway } from '../src/events/events.gateway';
import { DRIZZLE, type DrizzleDB } from '../src/db';
import * as schema from '../src/db/schema';
import { zeusConversations, zeusMemory, zeusTasks } from '../src/db/schema';

describe('ZeusService', () => {
  let service: ZeusService;
  let db: DrizzleDB;
  let llm: Pick<LlmService, 'getModel' | 'getDefaultModel'>;
  let events: EventsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
      ],
      providers: [
        {
          provide: DRIZZLE,
          useFactory: () => {
            const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/magically_v2' });
            return drizzle(pool, { schema });
          },
        },
        {
          provide: LlmService,
          useValue: {
            getModel: jest.fn(),
            getDefaultModel: jest.fn().mockReturnValue('test-model'),
          },
        },
        {
          provide: AgentsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
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

    db = module.get<DrizzleDB>(DRIZZLE);
    service = module.get<ZeusService>(ZeusService);
    llm = module.get<LlmService>(LlmService);
    events = module.get<EventsGateway>(EventsGateway);

    // Clean up tables before each test
    await db.delete(zeusTasks);
    await db.delete(zeusMemory);
    await db.delete(zeusConversations);
  });

  describe('createConversation', () => {
    it('creates a conversation with default chat mode', async () => {
      const conv = await service.createConversation();
      expect(conv.id).toBeDefined();
      expect(conv.mode).toBe('chat');
      expect(conv.messages).toEqual([]);
    });

    it('creates a conversation in build mode', async () => {
      const conv = await service.createConversation('build', 'my-agent');
      expect(conv.mode).toBe('build');
    });

    it('persists conversation to DB', async () => {
      const { id } = await service.createConversation();
      const fetched = await service.getConversation(id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(id);
    });
  });

  // streamChat tests removed — method was replaced by Agent SDK runPrompt.
  // See executor.spec.ts for runPrompt tests.

  describe('memory', () => {
    it('stores and retrieves a memory entry', async () => {
      await service.setMemory('user.name', 'Divya', 'user', 'user');
      const entries = await service.getMemory();
      const found = entries.find((e) => e.key === 'user.name');
      expect(found?.value).toBe('Divya');
    });

    it('updates an existing memory entry', async () => {
      await service.setMemory('pref.theme', 'dark', 'preference', 'user');
      await service.setMemory('pref.theme', 'light', 'preference', 'user');

      const entries = await service.getMemory();
      const themed = entries.filter((e) => e.key === 'pref.theme');
      expect(themed.length).toBe(1);
      expect(themed[0].value).toBe('light');
    });

    it('deletes a memory entry', async () => {
      await service.setMemory('temp.key', 'value', 'context', 'zeus');
      await service.deleteMemory('temp.key');

      const entries = await service.getMemory();
      expect(entries.find((e) => e.key === 'temp.key')).toBeUndefined();
    });
  });

  describe('zeus tasks', () => {
    it('creates a task with pending status', async () => {
      const id = await service.createTask({
        requesterId: 'calendar-hero',
        goal: 'Research attendees for 9am meeting',
        priority: 'high',
      });

      const tasks = await service.getTasks();
      const task = tasks.find((t) => t.id === id);
      expect(task?.status).toBe('pending');
      expect(task?.requesterId).toBe('calendar-hero');
    });

    it('sets status to awaiting_approval when requiresApproval is true', async () => {
      const id = await service.createTask({
        requesterId: 'superdo',
        goal: 'Research Mateo for Monster Jam',
        requiresApproval: true,
      });

      const tasks = await service.getTasks();
      const task = tasks.find((t) => t.id === id);
      expect(task?.status).toBe('awaiting_approval');
    });

    it('returns tasks sorted by createdAt descending', async () => {
      const id1 = await service.createTask({ requesterId: 'a', goal: 'First task' });
      const id2 = await service.createTask({ requesterId: 'b', goal: 'Second task' });

      // Bump id2's created_at to be later using drizzle sql template
      await db.execute(sql`UPDATE zeus_tasks SET created_at = created_at + interval '1 second' WHERE id = ${id2}`);

      const tasks = await service.getTasks();
      expect(tasks[0].goal).toBe('Second task');
      expect(tasks[1].goal).toBe('First task');
    });
  });

  // ─── Ticket #3: Chat API enhancements ────────────────────────────────

  describe('updateConversationTitle', () => {
    it('updates the title of a conversation', async () => {
      const { id } = await service.createConversation();
      await service.updateConversationTitle(id, 'My first chat');

      const conv = await service.getConversation(id);
      expect(conv!.title).toBe('My first chat');
    });

    it('clears title when set to null', async () => {
      const { id } = await service.createConversation();
      await service.updateConversationTitle(id, 'Temp title');
      await service.updateConversationTitle(id, null);

      const conv = await service.getConversation(id);
      expect(conv!.title).toBeNull();
    });
  });

  describe('createConversation with userId', () => {
    it('stores userId when provided', async () => {
      const { id } = await service.createConversation('chat', undefined, 'user-abc');
      const conv = await service.getConversation(id);
      expect(conv!.userId).toBe('user-abc');
    });
  });

  describe('listConversations with filters', () => {
    it('filters by userId', async () => {
      await service.createConversation('chat', undefined, 'user-A');
      await service.createConversation('chat', undefined, 'user-A');
      await service.createConversation('chat', undefined, 'user-B');

      const listA = await service.listConversations({ userId: 'user-A' });
      expect(listA).toHaveLength(2);

      const listB = await service.listConversations({ userId: 'user-B' });
      expect(listB).toHaveLength(1);
    });

    it('supports offset and limit', async () => {
      await service.createConversation('chat', undefined, 'paginate-user');
      await service.createConversation('chat', undefined, 'paginate-user');
      await service.createConversation('chat', undefined, 'paginate-user');

      const page1 = await service.listConversations({ userId: 'paginate-user', limit: 2 });
      expect(page1).toHaveLength(2);

      const page2 = await service.listConversations({ userId: 'paginate-user', limit: 2, offset: 2 });
      expect(page2).toHaveLength(1);
    });

    it('searches by title', async () => {
      const { id: id1 } = await service.createConversation('chat', undefined, 'search-user');
      await service.updateConversationTitle(id1, 'Debugging the API');
      const { id: id2 } = await service.createConversation('chat', undefined, 'search-user');
      await service.updateConversationTitle(id2, 'Planning sprint');

      const results = await service.listConversations({ userId: 'search-user', search: 'debug' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Debugging the API');
    });
  });
});
