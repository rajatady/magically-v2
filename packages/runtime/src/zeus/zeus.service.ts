import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, desc, gt, and, ilike } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { mkdir, access, writeFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { scaffoldAgent } from '@magically/shared/scaffold';
import { InjectDB, type DrizzleDB } from '../db';
import { zeusConversations, zeusMessages, zeusMemory, zeusTasks, agents, agentVersions } from '../db/schema';
import { AgentsService } from '../agents/agents.service';
import { EventsGateway } from '../events/events.gateway';
import { FeedService } from '../events/feed.service';
import { WidgetService } from '../events/widget.service';
import { LocalRunnerService } from '../agents/local-runner.service';
import { LocalDiscoveryService } from '../agents/local-discovery.service';
import { ScheduleService } from '../agents/schedule.service';
import { TriggerSchedulerService } from '../agents/trigger-scheduler.service';
import type { FileAttachment } from '@magically/shared/types';
import { executePrompt, type ExecutionCallbacks, type ContentBlock } from './executor';

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

export interface ListConversationsOptions {
  userId?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

@Injectable()
export class ZeusService {
  private readonly logger = new Logger(ZeusService.name);

  constructor(
    @InjectDB() private readonly db: DrizzleDB,
    private readonly agents: AgentsService,
    private readonly events: EventsGateway,
    private readonly emitter: EventEmitter2,
    private readonly feedService: FeedService,
    private readonly widgetService: WidgetService,
    private readonly localRunner: LocalRunnerService,
    private readonly localDiscovery: LocalDiscoveryService,
    private readonly scheduleService: ScheduleService,
    private readonly triggerScheduler: TriggerSchedulerService,
  ) {}

  // ─── Execution ──────────────────────────────────────────────────────

  async runPrompt(
    sessionId: string,
    prompt: string,
    userId: string,
    callbacks: ExecutionCallbacks,
    abortController?: AbortController,
    assistantMsgId?: string,
    files?: FileAttachment[],
  ) {
    // Get conversation for resume + history context
    const conversation = await this.getConversation(sessionId);
    const agentSessionIds = conversation?.agentSessionId
      ? [conversation.agentSessionId]
      : undefined;

    // Build conversation history from zeus_messages table
    const msgs = await this.getMessages(sessionId);
    const conversationHistory = msgs.length > 0
      ? msgs.map((m) => ({ role: m.role, content: m.content }))
      : undefined;

    // If no assistantMsgId provided (SSE fallback), create one
    const msgId = assistantMsgId ?? (await this.saveMessage(sessionId, 'assistant', '')).id;

    return executePrompt({
      sessionId,
      prompt,
      userId,
      assistantMsgId: msgId,
      agentSessionIds,
      conversationHistory,
      abortController,
      callbacks,
      zeus: this,
      agents: this.agents,
      files,
      localRunner: this.localRunner,
      localDiscovery: this.localDiscovery,
    });
  }

  private loadUserContext(): string {
    const contextDir = '/Users/kumardivyarajat/WebstormProjects/job-search/context';
    const files = ['kumar-profile.md', 'career-history.md', 'research-interests.md', 'strategy.md'];
    const parts: string[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(join(contextDir, file), 'utf-8');
        parts.push(`--- ${file} ---\n${content}`);
      } catch {
        // File not found, skip
      }
    }

    return parts.length > 0 ? `\nUser context:\n${parts.join('\n\n')}` : '';
  }

  async buildZeusContext(workspaceDir?: string): Promise<string> {
    const allAgents = await this.agents.findAll();
    const agentList = allAgents
      .map((a) => `- ${a.id}: ${a.name} — ${a.description ?? ''}`)
      .join('\n');

    const memory = await this.getMemory();
    const memoryList = memory
      .map((m) => `- [${m.category}] ${m.key}: ${m.value}`)
      .join('\n');

    const userContext = this.loadUserContext();

    const needsOnboarding = workspaceDir && !this.isOnboarded(workspaceDir);

    const parts = [
      ZEUS_SYSTEM_CONTEXT,
      '',
      `Installed agents:\n${agentList || 'None yet.'}`,
      '',
      memoryList ? `User memory:\n${memoryList}` : '',
      userContext,
    ];

    if (needsOnboarding) {
      parts.push('');
      parts.push(`IMPORTANT: This workspace has not been onboarded yet. The agent template has placeholder values (manifest.json has "my-agent" as the ID, "My Agent" as the name, etc.).

Before doing anything else, ask the user what they want to build and fill in these fields:
- Agent ID (lowercase, hyphens only, e.g., "grocery-list")
- Agent name (display name, e.g., "Grocery List")
- Description (what the agent does)

Once you have these, update manifest.json and AGENTS.md with the real values. Then create the file .magically/onboarded to mark onboarding as complete.

Do NOT create functions or triggers yet — just fill in the identity fields. The user may not know exactly what they want to build yet, and that's fine. The identity is enough to start.`);
    }

    return parts.filter(Boolean).join('\n');
  }

  async ensureWorkspace(userId: string): Promise<string> {
    const dir = join(DATA_DIR, 'workspaces', userId);
    const manifestPath = join(dir, 'manifest.json');

    if (!existsSync(manifestPath)) {
      scaffoldAgent(dir, {
        agentId: 'my-agent',
        agentName: 'My Agent',
        agentDescription: 'A new Magically agent',
      });
      this.logger.log(`Scaffolded new agent workspace for user ${userId}`);
    }

    // Sync workspace manifest → agents table as a draft
    await this.syncWorkspaceDraft(userId, dir, manifestPath);

    return dir;
  }

  private async syncWorkspaceDraft(userId: string, _dir: string, manifestPath: string): Promise<void> {
    try {
      const { readFileSync } = await import('fs');
      interface ManifestJson {
        name?: string;
        description?: string;
        icon?: string;
        version?: string;
      }
      const manifest: ManifestJson = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const agentId = `workspace-${userId}`;
      const now = new Date();

      await this.db
        .insert(agents)
        .values({
          id: agentId,
          name: manifest.name ?? 'My Agent',
          description: manifest.description ?? null,
          icon: manifest.icon ?? null,
          authorId: userId,
          latestVersion: manifest.version ?? '0.1.0',
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: agents.id,
          set: {
            name: manifest.name ?? 'My Agent',
            description: manifest.description ?? null,
            icon: manifest.icon ?? null,
            latestVersion: manifest.version ?? '0.1.0',
            updatedAt: now,
          },
        });
    } catch (err) {
      this.logger.warn(`Failed to sync workspace draft: ${err}`);
    }
  }

  isOnboarded(workspaceDir: string): boolean {
    return existsSync(join(workspaceDir, '.magically', 'onboarded'));
  }


  // ─── Conversation Management ─────────────────────────────────────────

  async createConversation(mode: 'chat' | 'build' | 'edit' | 'task' = 'chat', agentId?: string, userId?: string) {
    const id = randomUUID();
    const now = new Date();
    await this.db.insert(zeusConversations).values({
      id,
      mode,
      agentId,
      userId,
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

  /** Get conversation with messages from the zeus_messages table */
  async getConversationWithMessages(id: string) {
    const conv = await this.getConversation(id);
    if (!conv) return null;
    const msgs = await this.getMessages(id);
    return { ...conv, messages: msgs };
  }

  async updateConversationTitle(conversationId: string, title: string | null): Promise<void> {
    await this.db
      .update(zeusConversations)
      .set({ title, updatedAt: new Date() })
      .where(eq(zeusConversations.id, conversationId));
  }

  async listConversations(options: ListConversationsOptions = {}) {
    const { userId, limit = 50, offset = 0, search } = options;

    const conditions = [];
    if (userId) conditions.push(eq(zeusConversations.userId, userId));
    if (search) conditions.push(ilike(zeusConversations.title, `%${search}%`));

    const query = this.db
      .select({
        id: zeusConversations.id,
        title: zeusConversations.title,
        mode: zeusConversations.mode,
        agentId: zeusConversations.agentId,
        userId: zeusConversations.userId,
        createdAt: zeusConversations.createdAt,
        updatedAt: zeusConversations.updatedAt,
      })
      .from(zeusConversations)
      .orderBy(desc(zeusConversations.updatedAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }

  // ─── Message CRUD (zeus_messages table) ─────────────────────────────

  async saveMessage(
    conversationId: string,
    role: string,
    content: string,
    blocks?: ContentBlock[],
    sdkUuid?: string,
    files?: FileAttachment[],
  ): Promise<{ id: string }> {
    const id = randomUUID();
    await this.db.insert(zeusMessages).values({
      id,
      conversationId,
      role,
      content,
      blocks: blocks ? JSON.stringify(blocks) : null,
      files: files && files.length > 0 ? JSON.stringify(files) : null,
      sdkUuid: sdkUuid ?? null,
    });
    // Touch conversation updatedAt
    await this.db
      .update(zeusConversations)
      .set({ updatedAt: new Date() })
      .where(eq(zeusConversations.id, conversationId));
    return { id };
  }

  async updateMessage(
    messageId: string,
    content: string,
    blocks?: ContentBlock[],
    sdkUuid?: string,
  ): Promise<void> {
    const set: Record<string, string> = { content };
    if (blocks) set.blocks = JSON.stringify(blocks);
    if (sdkUuid) set.sdkUuid = sdkUuid;
    await this.db
      .update(zeusMessages)
      .set(set)
      .where(eq(zeusMessages.id, messageId));
  }

  async getMessages(conversationId: string, limit = 200, offset = 0) {
    return this.db
      .select()
      .from(zeusMessages)
      .where(eq(zeusMessages.conversationId, conversationId))
      .orderBy(zeusMessages.createdAt)
      .limit(limit)
      .offset(offset);
  }

  async deleteMessagesAfter(conversationId: string, messageId: string) {
    const msg = await this.db.select().from(zeusMessages).where(eq(zeusMessages.id, messageId)).limit(1);
    if (!msg[0]) return;
    await this.db.delete(zeusMessages).where(
      and(
        eq(zeusMessages.conversationId, conversationId),
        gt(zeusMessages.createdAt, msg[0].createdAt),
      ),
    );
  }

  async updateConversationAgentSessionId(conversationId: string, agentSessionId: string) {
    await this.db
      .update(zeusConversations)
      .set({ agentSessionId, updatedAt: new Date() })
      .where(eq(zeusConversations.id, conversationId));
    this.logger.log(`Agent session ${agentSessionId} linked to conversation ${conversationId}`);
  }

  async setRewindPoint(conversationId: string, sdkUuid: string) {
    await this.db
      .update(zeusConversations)
      .set({ rewindToSdkUuid: sdkUuid })
      .where(eq(zeusConversations.id, conversationId));
  }

  async getRewindPoint(conversationId: string): Promise<string | null> {
    const conv = await this.getConversation(conversationId);
    return conv?.rewindToSdkUuid ?? null;
  }

  async clearRewindPoint(conversationId: string) {
    await this.db
      .update(zeusConversations)
      .set({ rewindToSdkUuid: null })
      .where(eq(zeusConversations.id, conversationId));
  }

  async deleteConversation(id: string) {
    // Messages cascade-deleted via FK
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
    context?: Record<string, string>;
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

  async getFeed(limit = 50) {
    return this.feedService.findAll(limit);
  }

  async getWidgets(userId: string) {
    return this.widgetService.findByUser(userId);
  }

  async getSchedules(userId: string) {
    return this.scheduleService.findByUser(userId);
  }

  async createSchedule(userId: string, agentId: string, functionName: string, cron: string) {
    const schedule = await this.scheduleService.create({ userId, agentId, functionName, cron });
    await this.triggerScheduler.refresh();
    return { id: schedule.id };
  }

  async toggleSchedule(id: string, enabled: boolean) {
    await this.scheduleService.toggle(id, enabled);
    await this.triggerScheduler.refresh();
  }

  async deleteSchedule(id: string) {
    await this.scheduleService.remove(id);
    await this.triggerScheduler.refresh();
  }
}
