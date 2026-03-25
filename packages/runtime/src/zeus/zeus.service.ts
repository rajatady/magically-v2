import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../db/database.service.js';
import {
  zeusConversations,
  zeusMemory,
  zeusTasks,
} from '../db/schema.js';
import { LlmService, ChatMessage } from '../llm/llm.service.js';
import { AgentsService } from '../agents/agents.service.js';
import { EventsGateway } from '../events/events.gateway.js';

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
    private readonly db: DatabaseService,
    private readonly llm: LlmService,
    private readonly agents: AgentsService,
    private readonly events: EventsGateway,
    private readonly emitter: EventEmitter2,
  ) {}

  // ─── Conversation Management ─────────────────────────────────────────────

  createConversation(mode: 'chat' | 'build' | 'edit' | 'task' = 'chat', agentId?: string) {
    const id = randomUUID();
    const now = new Date();
    this.db.db.insert(zeusConversations).values({
      id,
      messages: [],
      mode,
      agentId,
      createdAt: now,
      updatedAt: now,
    }).run();
    return { id, mode, messages: [] };
  }

  getConversation(id: string) {
    return this.db.db
      .select()
      .from(zeusConversations)
      .where(eq(zeusConversations.id, id))
      .get();
  }

  // ─── Chat (SSE streaming) ─────────────────────────────────────────────────

  async *chat(
    conversationId: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    const conv = this.getConversation(conversationId);
    if (!conv) throw new Error(`Conversation ${conversationId} not found`);

    const history = (conv.messages as ChatMessage[]) ?? [];
    const newHistory: ChatMessage[] = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    // Inject agent context into system prompt
    const agentList = this.agents
      .findAll()
      .map((a) => `- ${a.manifest.id}: ${a.manifest.name} — ${a.manifest.description ?? ''}`)
      .join('\n');

    const systemPrompt = `${ZEUS_SYSTEM_PROMPT}\n\nInstalled agents:\n${agentList || 'None yet.'}`;

    // Emit typing event over WebSocket
    this.events.emit({ type: 'zeus:typing', conversationId });

    let fullResponse = '';

    for await (const chunk of this.llm.streamChat(newHistory, undefined, systemPrompt)) {
      if (chunk.content) {
        fullResponse += chunk.content;
        this.events.emit({
          type: 'zeus:chunk',
          conversationId,
          content: chunk.content,
        });
        yield chunk.content;
      }
    }

    // Persist updated conversation
    const updatedHistory: ChatMessage[] = [
      ...newHistory,
      { role: 'assistant', content: fullResponse },
    ];

    this.db.db
      .update(zeusConversations)
      .set({ messages: updatedHistory, updatedAt: new Date() })
      .where(eq(zeusConversations.id, conversationId))
      .run();

    this.events.emit({
      type: 'zeus:done',
      conversationId,
      message: fullResponse,
    });
  }

  // ─── Memory ───────────────────────────────────────────────────────────────

  getMemory() {
    return this.db.db.select().from(zeusMemory).all();
  }

  setMemory(key: string, value: string, category: string, source: string) {
    const now = new Date();
    const existing = this.db.db
      .select()
      .from(zeusMemory)
      .where(eq(zeusMemory.key, key))
      .get();

    if (existing) {
      this.db.db
        .update(zeusMemory)
        .set({ value, category, source, updatedAt: now })
        .where(eq(zeusMemory.key, key))
        .run();
    } else {
      this.db.db.insert(zeusMemory).values({
        id: randomUUID(),
        key,
        value,
        category,
        source,
        createdAt: now,
        updatedAt: now,
      }).run();
    }
  }

  deleteMemory(key: string) {
    this.db.db
      .delete(zeusMemory)
      .where(eq(zeusMemory.key, key))
      .run();
  }

  // ─── Zeus Tasks ───────────────────────────────────────────────────────────

  createTask(params: {
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
    this.db.db.insert(zeusTasks).values({
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
    }).run();
    return id;
  }

  getTasks() {
    return this.db.db
      .select()
      .from(zeusTasks)
      .orderBy(desc(zeusTasks.createdAt))
      .all();
  }
}
