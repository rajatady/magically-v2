/**
 * Zeus execution engine — wraps the Claude Agent SDK query() function.
 * Ported from cc-harness/packages/gateway/src/sessions/executor.ts,
 * adapted for Magically's multi-tenant model.
 *
 * Persistence strategy (inspired by cc-harness):
 * - Text deltas are accumulated in memory, NOT persisted individually
 * - Persist on SDK batch boundaries: assistant message events, tool results
 * - Final persist on completion or error
 * - Queries continue running on disconnect — client reconnects and fetches
 *
 * Session strategy:
 * - persistSession: true — SDK saves to ~/.claude/projects/ so resume works
 * - On first prompt: no resume, SDK creates a new session
 * - On subsequent prompts: try resume with stored agentSessionId
 * - If resume fails (session deleted/corrupted): fall back to fresh session,
 *   prepend conversation history as context in the prompt
 */
import { Logger } from '@nestjs/common';
import type { FileAttachment } from '@magically/shared/types';
import { createMagicallyMcpServer } from './tools';
import { buildPromptWithFiles } from './file-processor';
import type { AgentWithManifest } from '../agents/agents.service';

const logger = new Logger('ZeusExecutor');

// ─── SDK types ────────────────────────────────────────────────────────────────
// The Agent SDK doesn't export these types, so we define the shapes we consume.

interface SdkTextDelta {
  type: 'content_block_delta';
  delta: { type: 'text_delta'; text: string };
}

interface SdkToolBlockStart {
  type: 'content_block_start';
  content_block: { type: 'tool_use'; id: string; name: string };
}

type SdkStreamEvent = SdkTextDelta | SdkToolBlockStart;

interface SdkContentBlockText {
  type: 'text';
  text: string;
}

interface SdkContentBlockToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, string>;
}

interface SdkToolResultContent {
  type: 'text';
  text: string;
}

interface SdkToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | SdkToolResultContent[];
}

interface SdkStreamEventMessage {
  type: 'stream_event';
  session_id?: string;
  event?: SdkStreamEvent;
}

interface SdkAssistantMessage {
  type: 'assistant';
  message: { content: Array<SdkContentBlockText | SdkContentBlockToolUse> };
  parent_tool_use_id?: string | null;
}

interface SdkUserMessage {
  type: 'user';
  tool_use_result?: boolean;
  message: { content: SdkToolResultBlock[] };
}

interface SdkSystemMessage {
  type: 'system';
  subtype?: string;
  status?: string;
}

interface SdkResultMessage {
  type: 'result';
  subtype: string;
  result?: string;
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  modelUsage?: Record<string, number>;
  errors?: string[];
}

export type SdkMessage = SdkStreamEventMessage | SdkAssistantMessage | SdkUserMessage | SdkSystemMessage | SdkResultMessage;

// ─── Chat config ──────────────────────────────────────────────────────────────

export interface ChatConfig {
  tools: string[];
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  /** Whether to include Magically MCP tools (ListAgents, WriteMemory, etc.) */
  includeMcpTools: boolean;
}

/** Top-level chat: full tool access, all MCP tools, personal hub. */
export const TOP_LEVEL_CHAT_CONFIG: ChatConfig = {
  tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
  model: 'claude-sonnet-4-6',
  maxTurns: 30,
  maxBudgetUsd: 1.00,
  includeMcpTools: true,
};

/** Agent-scoped chat: restricted tools, no filesystem writes, no MCP. */
export const AGENT_SCOPED_CHAT_CONFIG: ChatConfig = {
  tools: ['Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
  model: 'claude-sonnet-4-6',
  maxTurns: 10,
  maxBudgetUsd: 0.25,
  includeMcpTools: false,
};

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  tool?: string;
  input?: Record<string, string>;
  result?: string;
  status?: 'running' | 'done';
  parentToolUseId?: string | null;
}

export interface ExecutionResult {
  cost: number;
  turns: number;
  durationMs: number;
  usage: Record<string, number> | null;
}

export interface ExecutionCallbacks {
  onChunk?: (content: string) => void;
  onToolStart?: (toolUseId: string, tool: string, input: Record<string, string>) => void;
  onToolResult?: (toolUseId: string, result: string) => void;
  onStatus?: (status: string) => void;
  onResult?: (result: ExecutionResult) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

/** Interface the executor + tools need from ZeusService */
export interface ExecutorZeusDelegate {
  ensureWorkspace(userId: string): Promise<string>;
  buildZeusContext(workspaceDir?: string): Promise<string>;
  updateMessage(messageId: string, content: string, blocks?: ContentBlock[], sdkUuid?: string): Promise<void>;
  updateConversationAgentSessionId(conversationId: string, agentSessionId: string): Promise<void>;
  getMemory(): Promise<Array<{ key: string; value: string; category: string; source: string }>>;
  setMemory(key: string, value: string, category: string, source: string): Promise<void>;
  deleteMemory(key: string): Promise<void>;
  createTask(params: { requesterId: string; goal: string; priority?: 'low' | 'normal' | 'high' }): Promise<string>;
  getTasks(): Promise<Array<{ id: string; status: string; goal: string; priority: string; requesterId: string }>>;
  getFeed(limit?: number): Promise<Array<{ id: string; agentId: string | null; type: string; title: string; body: string | null; data: unknown; createdAt: Date }>>;
  getWidgets(userId: string): Promise<Array<{ agentId: string; size: string; html: string; updatedAt: Date }>>;
}

/** Interface the executor + tools need from AgentsService */
export interface ExecutorAgentsDelegate {
  findAll(): Promise<AgentWithManifest[]>;
  findOne(id: string): Promise<AgentWithManifest>;
}

export interface ExecutionOptions {
  sessionId: string;
  prompt: string;
  userId: string;
  /** Pre-created assistant message ID for incremental updates */
  assistantMsgId: string;
  /** SDK session IDs to try resuming from (most recent first) */
  agentSessionIds?: string[];
  /** Prior conversation messages for context if resume fails */
  conversationHistory?: Array<{ role: string; content: string }>;
  abortController?: AbortController;
  callbacks: ExecutionCallbacks;
  zeus: ExecutorZeusDelegate;
  agents: ExecutorAgentsDelegate;
  /** Override SDK config (tools, model, budget). Defaults to TOP_LEVEL_CHAT_CONFIG. */
  chatConfig?: ChatConfig;
  /** File attachments to include in the prompt */
  files?: FileAttachment[];
}

// ─── SDK loader ───────────────────────────────────────────────────────────────
// Dynamic import avoids CJS/ESM mismatch at compile time.
// We inline the import and let TypeScript infer the SDK's own types.

async function loadSdk() {
  return import('@anthropic-ai/claude-agent-sdk');
}

// ─── Query builder ────────────────────────────────────────────────────────────

interface BuildQueryArgs {
  workspaceDir: string;
  zeusContext: string;
  mcpServer: Awaited<ReturnType<typeof createMagicallyMcpServer>>;
  config: ChatConfig;
  abortController?: AbortController;
  resumeSessionId?: string;
}

function buildQueryOptions(args: BuildQueryArgs) {
  const { workspaceDir, zeusContext, mcpServer, config, abortController, resumeSessionId } = args;

  return {
    cwd: workspaceDir,
    systemPrompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: zeusContext,
    },
    tools: config.tools,
    allowedTools: config.tools,
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    ...(config.includeMcpTools ? { mcpServers: { magically: mcpServer } } : {}),
    includePartialMessages: true,
    enableFileCheckpointing: true,
    persistSession: true,
    maxTurns: config.maxTurns,
    maxBudgetUsd: config.maxBudgetUsd,
    model: config.model,
    settingSources: [] as Array<'user' | 'project' | 'local'>,
    ...(resumeSessionId ? { resume: resumeSessionId } : {}),
    ...(abortController ? { abortController } : {}),
  };
}

/**
 * Build a prompt that includes conversation history as context
 * when we can't resume an SDK session.
 */
function buildPromptWithHistory(
  prompt: string,
  history?: Array<{ role: string; content: string }>,
): string {
  if (!history || history.length === 0) return prompt;

  const contextLines = history.map((m) =>
    `[${m.role}]: ${m.content.slice(0, 500)}`,
  );

  return [
    'Here is the conversation so far (for context — you may not remember it):',
    '---',
    ...contextLines,
    '---',
    '',
    'Now, the user says:',
    prompt,
  ].join('\n');
}

// ─── Message processors ───────────────────────────────────────────────────────

function processStreamEvent(
  event: SdkStreamEvent,
  fullResponse: string,
  orderedBlocks: ContentBlock[],
  callbacks: ExecutionCallbacks,
): string {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    fullResponse += event.delta.text;
    const last = orderedBlocks[orderedBlocks.length - 1];
    if (last && last.type === 'text') {
      last.text = (last.text ?? '') + event.delta.text;
    } else {
      orderedBlocks.push({ type: 'text', text: event.delta.text });
    }
    callbacks.onChunk?.(fullResponse);
  }

  if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
    const block = event.content_block;
    orderedBlocks.push({ type: 'tool_use', id: block.id, tool: block.name, input: {}, status: 'running' });
    callbacks.onToolStart?.(block.id, block.name, {});
  }

  return fullResponse;
}

function processAssistantMessage(
  msg: SdkAssistantMessage,
  orderedBlocks: ContentBlock[],
  callbacks: ExecutionCallbacks,
): void {
  const contentBlocks = msg.message.content;
  const parentId = msg.parent_tool_use_id ?? null;

  for (const block of contentBlocks) {
    if (block.type === 'tool_use') {
      const existing = orderedBlocks.find((b) => b.type === 'tool_use' && b.id === block.id);
      if (existing && existing.type === 'tool_use') {
        existing.input = block.input;
      } else {
        orderedBlocks.push({ type: 'tool_use', id: block.id, tool: block.name, input: block.input, status: 'running', parentToolUseId: parentId });
        callbacks.onToolStart?.(block.id, block.name, block.input);
      }
    }
  }
}

function processToolResult(
  msg: SdkUserMessage,
  orderedBlocks: ContentBlock[],
  callbacks: ExecutionCallbacks,
): void {
  for (const block of msg.message.content) {
    if (block.type === 'tool_result' && block.tool_use_id) {
      const resultText = typeof block.content === 'string'
        ? block.content
        : block.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      const ob = orderedBlocks.find((b) => b.type === 'tool_use' && b.id === block.tool_use_id);
      if (ob && ob.type === 'tool_use') {
        ob.result = resultText.slice(0, 2000);
        ob.status = 'done';
      }
      callbacks.onToolResult?.(block.tool_use_id, resultText.slice(0, 2000));
    }
  }
}

// ─── Persistence helper ───────────────────────────────────────────────────────

function persistMessage(
  zeus: ExecutorZeusDelegate,
  assistantMsgId: string,
  content: string,
  blocks: ContentBlock[],
  label: string,
): void {
  zeus.updateMessage(assistantMsgId, content, blocks.length > 0 ? blocks : undefined).catch((err: Error) => {
    logger.warn(`Persistence failed (${label}): ${err.message}`);
  });
}

async function persistMessageAwait(
  zeus: ExecutorZeusDelegate,
  assistantMsgId: string,
  content: string,
  blocks: ContentBlock[],
  label: string,
): Promise<void> {
  try {
    await zeus.updateMessage(assistantMsgId, content, blocks.length > 0 ? blocks : undefined);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Persistence failed (${label}): ${message}`);
  }
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executePrompt(options: ExecutionOptions) {
  const {
    sessionId, prompt, userId, assistantMsgId, agentSessionIds, conversationHistory,
    abortController, callbacks, zeus, agents, chatConfig, files,
  } = options;

  const config = chatConfig ?? TOP_LEVEL_CHAT_CONFIG;

  const sdk = await loadSdk();
  const workspaceDir = await zeus.ensureWorkspace(userId);
  const mcpServer = await createMagicallyMcpServer({ agents, zeus, userId });
  const zeusContext = await zeus.buildZeusContext(workspaceDir);

  const queryArgs = { workspaceDir, zeusContext, mcpServer, config };

  // Try to resume from most recent SDK session, fall back to fresh
  let queryResult: AsyncIterable<SdkMessage> | null = null;
  let resumeSucceeded = false;

  // Always include conversation history so the model has context.
  // SDK resume is a bonus for internal SDK state, but our DB messages are the source of truth.
  const textPrompt = buildPromptWithHistory(prompt, conversationHistory);

  // If files attached, build content blocks with base64 data.
  // This must happen BEFORE the resume/fresh split so both paths include files.
  const effectivePrompt = files && files.length > 0
    ? await buildPromptWithFiles(textPrompt, files)
    : textPrompt;

  if (agentSessionIds && agentSessionIds.length > 0) {
    for (const sid of agentSessionIds) {
      try {
        logger.log(`Attempting resume from SDK session ${sid}`);
        queryResult = sdk.query({
          prompt: effectivePrompt,
          options: buildQueryOptions({ ...queryArgs, abortController, resumeSessionId: sid }),
        }) as AsyncIterable<SdkMessage>;
        resumeSucceeded = true;
        break;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Resume failed for session ${sid}: ${msg}`);
      }
    }
  }

  // If resume didn't work (or no sessions to resume), start fresh
  if (!queryResult) {
    queryResult = sdk.query({
      prompt: effectivePrompt,
      options: buildQueryOptions({ ...queryArgs, abortController }),
    }) as AsyncIterable<SdkMessage>;
  }

  let fullResponse = '';
  let savedAgentSessionId = false;
  const orderedBlocks: ContentBlock[] = [];

  try {
    for await (const message of queryResult) {
      if (abortController?.signal.aborted) break;

      // Persist SDK session ID for future resume
      if (!savedAgentSessionId && message.type === 'stream_event' && message.session_id) {
        await zeus.updateConversationAgentSessionId(sessionId, message.session_id);
        savedAgentSessionId = true;
      }

      switch (message.type) {
        case 'stream_event': {
          if (!message.event) break;
          // Text deltas are NOT persisted here — accumulated in memory.
          // Persistence happens on assistant message events (SDK batch boundaries),
          // tool result events, and final completion.
          fullResponse = processStreamEvent(message.event, fullResponse, orderedBlocks, callbacks);
          break;
        }

        case 'assistant': {
          processAssistantMessage(message, orderedBlocks, callbacks);
          // Persist at SDK batch boundary — this is a natural checkpoint
          persistMessage(zeus, assistantMsgId, fullResponse, orderedBlocks, 'assistant event');
          break;
        }

        case 'user': {
          if (message.tool_use_result) {
            processToolResult(message, orderedBlocks, callbacks);
            // Persist after tool results — each tool completion is a checkpoint
            persistMessage(zeus, assistantMsgId, fullResponse, orderedBlocks, 'tool result');
          }
          break;
        }

        case 'system': {
          if (message.subtype === 'status' && message.status) {
            callbacks.onStatus?.(message.status);
          }
          break;
        }

        case 'result': {
          if (message.subtype === 'success' && message.result && !fullResponse) {
            fullResponse = message.result;
            callbacks.onChunk?.(fullResponse);
          }
          callbacks.onResult?.({
            cost: message.total_cost_usd ?? 0,
            turns: message.num_turns ?? 0,
            durationMs: message.duration_ms ?? 0,
            usage: message.modelUsage ?? null,
          });
          if (message.subtype !== 'success') {
            callbacks.onError?.(message.errors?.join('; ') ?? message.subtype ?? 'Unknown error');
          }
          break;
        }
      }
    }

    // Final persist with complete content
    await persistMessageAwait(zeus, assistantMsgId, fullResponse, orderedBlocks, 'final');
    callbacks.onDone?.();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Execution error: ${errorMessage}`);
    // Persist partial response on error
    if (fullResponse || orderedBlocks.length > 0) {
      await persistMessageAwait(zeus, assistantMsgId, fullResponse || '[Error during execution]', orderedBlocks, 'error recovery');
    }
    callbacks.onError?.(errorMessage);
  }

  return { fullResponse, blocks: orderedBlocks };
}
