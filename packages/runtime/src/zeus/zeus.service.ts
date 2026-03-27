import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  streamText,
  createUIMessageStream,
  convertToModelMessages,
  stepCountIs,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { InjectDB, type DrizzleDB } from '../db';
import {
  zeusConversations,
  zeusMemory,
  zeusTasks,
} from '../db/schema';
import { LlmService } from '../llm/llm.service';
import { AgentsService } from '../agents/agents.service';
import { EventsGateway } from '../events/events.gateway';

const ZEUS_SYSTEM_PROMPT = `You are Zeus, the trusted AI companion inside Magically — a personal Agent OS.

You are the kernel of the system. You have access to all agents, tools, and the user's memory.

Your responsibilities:
1. Help users accomplish tasks by routing to the right agents and tools
2. Build new agents when asked, by creating their manifest, UI, and logic
3. Maintain memory about the user to personalize experiences
4. Orchestrate complex multi-step tasks across agents

Key behaviors:
- Be warm, direct, and efficient. No filler.
- When building agents, create a brief "blueprint" first and confirm with the user.
- You know what agents are installed and their capabilities.
- Route "add brisket to grocery list" → find GroceryList agent → call its function.
- If an agent doesn't exist, suggest building one or offer an alternative.

You are NOT a chatbot. You are an operating system kernel that happens to speak.`;

@Injectable()
export class ZeusService {
  private readonly logger = new Logger(ZeusService.name);

  constructor(
    @InjectDB() private readonly db: DrizzleDB,
    private readonly llm: LlmService,
    private readonly agents: AgentsService,
    private readonly events: EventsGateway,
    private readonly emitter: EventEmitter2,
  ) {}

  // ─── Streaming Chat ───────────────────────────────────────────────────────

  async streamChat(messages: UIMessage[], conversationId?: string): Promise<ReadableStream<UIMessageChunk>> {
    const system = await this.buildSystemPrompt();
    const modelMessages = await convertToModelMessages(messages);

    return createUIMessageStream({
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: this.llm.getModel(),
          system,
          messages: modelMessages,
          stopWhen: stepCountIs(5),
        });
        dataStream.merge(result.toUIMessageStream());
      },
      onFinish: async ({ messages: finishedMessages }) => {
        if (!conversationId || finishedMessages.length === 0) return;
        try {
          const serialized = finishedMessages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.parts
              .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              .map((p) => p.text)
              .join(''),
            parts: m.parts,
          }));
          await this.db
            .update(zeusConversations)
            .set({ messages: [...messages, ...serialized], updatedAt: new Date() })
            .where(eq(zeusConversations.id, conversationId));
        } catch (err) {
          this.logger.error('Failed to persist Zeus conversation', err);
        }
      },
      onError: () => 'An error occurred. Please try again.',
    });
  }

  private async buildSystemPrompt(): Promise<string> {
    const allAgents = await this.agents.findAll();
    const agentList = allAgents
      .map((a) => `- ${a.id}: ${a.name} — ${a.description ?? ''}`)
      .join('\n');
    return `${ZEUS_SYSTEM_PROMPT}\n\nInstalled agents:\n${agentList || 'None yet.'}`;
  }

  // ─── Conversation Management ─────────────────────────────────────────────

  async createConversation(mode: 'chat' | 'build' | 'edit' | 'task' = 'chat', agentId?: string) {
    const id = randomUUID();
    const now = new Date();
    await this.db.insert(zeusConversations).values({
      id,
      messages: [],
      mode,
      agentId,
      createdAt: now,
      updatedAt: now,
    });
    return { id, mode, messages: [] };
  }

  async getConversation(id: string) {
    const rows = await this.db
      .select()
      .from(zeusConversations)
      .where(eq(zeusConversations.id, id))
      .limit(1);
    return rows[0];
  }

  // ─── Memory ───────────────────────────────────────────────────────────────

  async getMemory() {
    return await this.db.select().from(zeusMemory);
  }

  async setMemory(key: string, value: string, category: string, source: string) {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(zeusMemory)
      .where(eq(zeusMemory.key, key))
      .limit(1);
    const existing = rows[0];

    if (existing) {
      await this.db
        .update(zeusMemory)
        .set({ value, category, source, updatedAt: now })
        .where(eq(zeusMemory.key, key));
    } else {
      await this.db.insert(zeusMemory).values({
        id: randomUUID(),
        key,
        value,
        category,
        source,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  async deleteMemory(key: string) {
    await this.db
      .delete(zeusMemory)
      .where(eq(zeusMemory.key, key));
  }

  // ─── Zeus Tasks ───────────────────────────────────────────────────────────

  async createTask(params: {
    requesterId: string;
    goal: string;
    context?: unknown;
    deliverables?: string[];
    priority?: 'low' | 'normal' | 'high';
    requiresApproval?: boolean;
    callbackEndpoint?: string;
  }) {
    const id = randomUUID();
    const now = new Date();
    await this.db.insert(zeusTasks).values({
      id,
      requesterId: params.requesterId,
      goal: params.goal,
      context: params.context,
      deliverables: params.deliverables,
      priority: params.priority ?? 'normal',
      requiresApproval: params.requiresApproval ?? false,
      status: params.requiresApproval ? 'awaiting_approval' : 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async getTasks() {
    return await this.db
      .select()
      .from(zeusTasks)
      .orderBy(desc(zeusTasks.createdAt));
  }
}
