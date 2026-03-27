/**
 * Zeus execution engine — wraps the Claude Agent SDK query() function.
 * Ported from cc-harness/packages/gateway/src/sessions/executor.ts,
 * adapted for Magically's multi-tenant model.
 *
 * Session strategy:
 * - persistSession: true — SDK saves to ~/.claude/projects/ so resume works
 * - On first prompt: no resume, SDK creates a new session
 * - On subsequent prompts: try resume with stored agentSessionId
 * - If resume fails (session deleted/corrupted): fall back to fresh session,
 *   prepend conversation history as context in the prompt
 */
import { Logger } from '@nestjs/common';
import type { ZeusService } from './zeus.service';
import type { AgentsService } from '../agents/agents.service';
import { createMagicallyMcpServer } from './tools';

const logger = new Logger('ZeusExecutor');

let _sdk: { query: Function; [key: string]: unknown };
async function getSdk() {
  if (!_sdk) _sdk = await import('@anthropic-ai/claude-agent-sdk') as typeof _sdk;
  return _sdk;
}

export interface ContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  tool?: string;
  input?: unknown;
  result?: string;
  status?: 'running' | 'done';
  parentToolUseId?: string | null;
}

export interface ExecutionCallbacks {
  onChunk?: (content: string) => void;
  onToolStart?: (toolUseId: string, tool: string, input: unknown) => void;
  onToolResult?: (toolUseId: string, result: string) => void;
  onStatus?: (status: string) => void;
  onResult?: (result: { cost: number; turns: number; durationMs: number; usage: unknown }) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

export interface ExecutionOptions {
  sessionId: string;
  prompt: string;
  userId: string;
  /** SDK session IDs to try resuming from (most recent first) */
  agentSessionIds?: string[];
  /** Prior conversation messages for context if resume fails */
  conversationHistory?: Array<{ role: string; content: string }>;
  abortController?: AbortController;
  callbacks: ExecutionCallbacks;
  zeus: ZeusService;
  agents: AgentsService;
}

function buildQueryOptions(
  workspaceDir: string,
  zeusContext: string,
  mcpServer: unknown,
  abortController?: AbortController,
  resumeSessionId?: string,
) {
  return {
    cwd: workspaceDir,
    systemPrompt: {
      type: 'preset' as const,
      preset: 'claude_code' as const,
      append: zeusContext,
    },
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
    permissionMode: 'bypassPermissions' as const,
    allowDangerouslySkipPermissions: true,
    mcpServers: { magically: mcpServer },
    includePartialMessages: true,
    enableFileCheckpointing: true,
    persistSession: true,
    maxTurns: 30,
    maxBudgetUsd: 1.00,
    model: 'claude-sonnet-4-6',
    settingSources: [] as string[],
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

export async function executePrompt(options: ExecutionOptions) {
  const {
    sessionId, prompt, userId, agentSessionIds, conversationHistory,
    abortController, callbacks, zeus, agents,
  } = options;

  const sdk = await getSdk();
  const workspaceDir = await zeus.ensureWorkspace(userId);
  const mcpServer = await createMagicallyMcpServer({ agents, zeus, userId });
  const zeusContext = await zeus.buildZeusContext();

  // Try to resume from most recent SDK session, fall back to fresh
  let queryResult: AsyncIterable<Record<string, unknown>> | null = null;
  let resumeSucceeded = false;

  if (agentSessionIds && agentSessionIds.length > 0) {
    for (const sid of agentSessionIds) {
      try {
        logger.log(`Attempting resume from SDK session ${sid}`);
        queryResult = sdk.query({
          prompt,
          options: buildQueryOptions(workspaceDir, zeusContext, mcpServer, abortController, sid),
        }) as AsyncIterable<Record<string, unknown>>;
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
    const effectivePrompt = resumeSucceeded
      ? prompt
      : buildPromptWithHistory(prompt, conversationHistory);

    queryResult = sdk.query({
      prompt: effectivePrompt,
      options: buildQueryOptions(workspaceDir, zeusContext, mcpServer, abortController),
    }) as AsyncIterable<Record<string, unknown>>;
  }

  let fullResponse = '';
  let savedAgentSessionId = false;
  const orderedBlocks: ContentBlock[] = [];

  try {
    for await (const message of queryResult) {
      if (abortController?.signal.aborted) break;

      const msg = message as Record<string, unknown>;

      // Persist SDK session ID for future resume
      if (!savedAgentSessionId && msg.session_id && typeof msg.session_id === 'string') {
        await zeus.updateConversationAgentSessionId(sessionId, msg.session_id);
        savedAgentSessionId = true;
      }

      switch (msg.type) {
        case 'stream_event': {
          const event = msg.event as { type: string; delta?: { type: string; text: string }; content_block?: { type: string; id: string; name: string } } | undefined;
          if (!event) break;

          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            fullResponse += event.delta.text;
            const last = orderedBlocks[orderedBlocks.length - 1];
            if (last && last.type === 'text') {
              last.text = (last.text ?? '') + event.delta.text;
            } else {
              orderedBlocks.push({ type: 'text', text: event.delta.text });
            }
            callbacks.onChunk?.(fullResponse);
          }

          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            const block = event.content_block;
            orderedBlocks.push({ type: 'tool_use', id: block.id, tool: block.name, input: {}, status: 'running' });
            callbacks.onToolStart?.(block.id, block.name, {});
          }
          break;
        }

        case 'assistant': {
          // When includePartialMessages is true, text arrives via stream_event
          // deltas first, then the complete assistant message follows.
          // Only process tool_use blocks here — text was already handled above.
          const contentBlocks = (msg.message as { content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> })?.content ?? [];
          const parentId = (msg.parent_tool_use_id as string | null) ?? null;

          for (const block of contentBlocks) {
            if (block.type === 'tool_use') {
              // Deduplicate — may already exist from stream_event content_block_start
              const existing = orderedBlocks.find((b) => b.type === 'tool_use' && b.id === block.id);
              if (existing && existing.type === 'tool_use') {
                existing.input = block.input; // update with full parsed input
              } else {
                orderedBlocks.push({ type: 'tool_use', id: block.id, tool: block.name, input: block.input, status: 'running', parentToolUseId: parentId });
                callbacks.onToolStart?.(block.id!, block.name!, block.input);
              }
            }
          }
          break;
        }

        case 'user': {
          if (msg.tool_use_result !== undefined) {
            const msgContent = (msg.message as { content?: Array<{ type: string; tool_use_id?: string; content?: unknown }> })?.content;
            if (Array.isArray(msgContent)) {
              for (const block of msgContent) {
                if (block.type === 'tool_result' && block.tool_use_id) {
                  const resultText = typeof block.content === 'string'
                    ? block.content
                    : Array.isArray(block.content)
                      ? (block.content as Array<{ type: string; text?: string }>).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
                      : JSON.stringify(block.content);
                  const ob = orderedBlocks.find((b) => b.type === 'tool_use' && b.id === block.tool_use_id);
                  if (ob && ob.type === 'tool_use') {
                    ob.result = resultText.slice(0, 2000);
                    ob.status = 'done';
                  }
                  callbacks.onToolResult?.(block.tool_use_id, resultText.slice(0, 2000));
                }
              }
            }
          }
          break;
        }

        case 'system': {
          const subtype = msg.subtype as string | undefined;
          const status = msg.status as string | undefined;
          if (subtype === 'status' && status) {
            callbacks.onStatus?.(status);
          }
          break;
        }

        case 'result': {
          const subtype = msg.subtype as string | undefined;
          if (subtype === 'success' && msg.result && !fullResponse) {
            fullResponse = String(msg.result);
            callbacks.onChunk?.(fullResponse);
          }
          callbacks.onResult?.({
            cost: (msg.total_cost_usd as number) ?? 0,
            turns: (msg.num_turns as number) ?? 0,
            durationMs: (msg.duration_ms as number) ?? 0,
            usage: msg.modelUsage ?? null,
          });
          if (subtype !== 'success') {
            const errors = msg.errors as string[] | undefined;
            callbacks.onError?.(errors?.join('; ') ?? subtype ?? 'Unknown error');
          }
          break;
        }
      }
    }

    callbacks.onDone?.();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Execution error: ${message}`);
    callbacks.onError?.(message);
  }

  return { fullResponse, blocks: orderedBlocks };
}
