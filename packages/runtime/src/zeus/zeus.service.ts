import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { InjectDB, type DrizzleDB } from '../db';
import { zeusConversations, zeusMemory, zeusTasks } from '../db/schema';
import { AgentsService } from '../agents/agents.service';
import { EventsGateway } from '../events/events.gateway';
import { executePrompt, type ExecutionCallbacks } from './executor';

import { tmpdir, homedir } from 'os';

const DATA_DIR = process.env.DATA_DIR
  ?? (process.env.NODE_ENV === 'production' ? '/data' : join(homedir(), '.magically'));

const ZEUS_SYSTEM_CONTEXT = `You are Zeus, the trusted AI companion inside Magically — a personal Agent OS.

You are the kernel of the system. You have access to all agents, tools, and the user's memory.

Your responsibilities:
1. Help users accomplish tasks by routing to the right agents and tools
2. Build new agents when asked — create their manifest, functions, and UI in the user's workspace
3. Maintain memory about the user to personalize experiences
4. Orchestrate complex multi-step tasks across agents

Key behaviors:
- Be warm, direct, and efficient. No filler.
- When building agents, create a brief "blueprint" first and confirm with the user.
- You know what agents are installed and their capabilities.
- Use the Magically MCP tools (ListAgents, WriteMemory, CreateTask, etc.) for OS operations.
- Use Read/Write/Edit/Bash for file operations in the user's workspace.

You are NOT a chatbot. You are an operating system kernel that happens to speak.`;

@Injectable()
export class ZeusService {
  private readonly logger = new Logger(ZeusService.name);

  constructor(
    @InjectDB() private readonly db: DrizzleDB,
    private readonly agents: AgentsService,
    private readonly events: EventsGateway,
    private readonly emitter: EventEmitter2,
  ) {}

  // ─── Execution ──────────────────────────────────────────────────────

  async runPrompt(
    sessionId: string,
    prompt: string,
    userId: string,
    callbacks: ExecutionCallbacks,
    abortController?: AbortController,
  ) {
    // Get agent session ID for resume if conversation exists
    const conversation = await this.getConversation(sessionId);
    const agentSessionId = conversation?.agentSessionId ?? undefined;

    return executePrompt({
      sessionId,
      prompt,
      userId,
      agentSessionId,
      abortController,
      callbacks,
      zeus: this,
      agents: this.agents,
    });
  }

  async buildZeusContext(): Promise<string> {
    const allAgents = await this.agents.findAll();
    const agentList = allAgents
      .map((a) => `- ${a.id}: ${a.name} — ${a.description ?? ''}`)
      .join('\n');

    const memory = await this.getMemory();
    const memoryList = memory
      .map((m) => `- [${m.category}] ${m.key}: ${m.value}`)
      .join('\n');

    return [
      ZEUS_SYSTEM_CONTEXT,
      '',
      `Installed agents:\n${agentList || 'None yet.'}`,
      '',
      memoryList ? `User memory:\n${memoryList}` : '',
    ].filter(Boolean).join('\n');
  }

  async ensureWorkspace(userId: string): Promise<string> {
    const dir = join(DATA_DIR, 'workspaces', userId);
    await mkdir(dir, { recursive: true });
    return dir;
  }

  // ─── Conversation Management ─────────────────────────────────────────

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
    return rows[0] as (typeof rows)[0] & { agentSessionId?: string } | undefined;
  }

  async listConversations(limit = 50) {
    return this.db
      .select()
      .from(zeusConversations)
      .orderBy(desc(zeusConversations.updatedAt))
      .limit(limit);
  }

  async updateConversationAgentSessionId(conversationId: string, agentSessionId: string) {
    await this.db
      .update(zeusConversations)
      .set({ updatedAt: new Date() })
      .where(eq(zeusConversations.id, conversationId));
    // Note: agentSessionId column needs to be added to schema in Phase 5
    this.logger.log(`Agent session ${agentSessionId} linked to conversation ${conversationId}`);
  }

  async deleteConversation(id: string) {
    await this.db
      .delete(zeusConversations)
      .where(eq(zeusConversations.id, id));
  }

  // ─── Memory ──────────────────────────────────────────────────────────

  async getMemory() {
    return this.db.select().from(zeusMemory);
  }

  async setMemory(key: string, value: string, category: string, source: string) {
    const now = new Date();
    const rows = await this.db
      .select()
      .from(zeusMemory)
      .where(eq(zeusMemory.key, key))
      .limit(1);

    if (rows[0]) {
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
    await this.db.delete(zeusMemory).where(eq(zeusMemory.key, key));
  }

  // ─── Tasks ──────────────────────────────────────────────────────────

  async createTask(params: {
    requesterId: string;
    goal: string;
    context?: unknown;
    deliverables?: string[];
    priority?: 'low' | 'normal' | 'high';
    requiresApproval?: boolean;
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
    return this.db
      .select()
      .from(zeusTasks)
      .orderBy(desc(zeusTasks.createdAt));
  }
}
