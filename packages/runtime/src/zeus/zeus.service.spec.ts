import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import type { LanguageModelV3StreamResult } from '@ai-sdk/provider';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import { ZeusService } from './zeus.service';
import { LlmService } from '../llm/llm.service';
import { AgentsService } from '../agents/agents.service';
import { EventsGateway } from '../events/events.gateway';
import { DRIZZLE, type DrizzleDB } from '../db';
import * as schema from '../db/schema';
import { zeusConversations, zeusMemory, zeusTasks } from '../db/schema';

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

  describe('streamChat', () => {
    function makeMockModel(textDelta = 'Hello world') {
      const streamResult: LanguageModelV3StreamResult = {
        stream: convertArrayToReadableStream([
          { type: 'text-delta', textDelta },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5 } },
        ]) as unknown as ReadableStream<import('@ai-sdk/provider').LanguageModelV3StreamPart>,
      };
      return new MockLanguageModelV3({ doStream: streamResult });
    }

    it('returns a ReadableStream', async () => {
      (llm.getModel as jest.Mock).mockReturnValue(makeMockModel());
      const stream = await service.streamChat([
        { id: 'msg-1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] },
      ]);
      expect(stream).toBeInstanceOf(ReadableStream);
    });

    it('persists assistant response to conversation when conversationId is provided', async () => {
      (llm.getModel as jest.Mock).mockReturnValue(makeMockModel('Zeus response'));

      const { id: conversationId } = await service.createConversation();
      const stream = await service.streamChat(
        [{ id: 'msg-1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] }],
        conversationId,
      );

      // Drain the stream to trigger onFinish
      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }

      // Give onFinish a tick to complete async DB write
      await new Promise((r) => setTimeout(r, 100));

      const conv = await service.getConversation(conversationId);
      const messages = conv!.messages as Array<{ role: string; content: string }>;
      expect(messages.length).toBeGreaterThan(0);
      const assistantMsg = messages.find((m) => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
    });

    it('streams without error when no conversationId provided', async () => {
      (llm.getModel as jest.Mock).mockReturnValue(makeMockModel());
      const stream = await service.streamChat([
        { id: 'msg-1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] },
      ]);
      const reader = stream.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
      // Reaching here means the stream completed without throwing
    });
  });

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
});
