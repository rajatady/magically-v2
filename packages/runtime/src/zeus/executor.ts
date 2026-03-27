/**
 * Zeus execution engine — wraps the Claude Agent SDK query() function.
 * Ported from cc-harness/packages/gateway/src/sessions/executor.ts,
 * adapted for Magically's multi-tenant model.
 */
import type { ZeusService } from './zeus.service';
import type { AgentsService } from '../agents/agents.service';
import { createMagicallyMcpServer } from './tools';

// Lazy-loaded SDK — dynamic import() at runtime avoids CJS/ESM mismatch at compile time
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
  agentSessionId?: string;
  abortController?: AbortController;
  callbacks: ExecutionCallbacks;
  zeus: ZeusService;
  agents: AgentsService;
}

export async function executePrompt(options: ExecutionOptions) {
  const { sessionId, prompt, userId, agentSessionId, abortController, callbacks, zeus, agents } = options;

  const sdk = await getSdk();

  // Ensure user workspace exists
  const workspaceDir = await zeus.ensureWorkspace(userId);

  // Create MCP server with user-scoped dependencies
  const mcpServer = await createMagicallyMcpServer({ agents, zeus, userId });

  // Build Zeus context to append to system prompt
  const zeusContext = await zeus.buildZeusContext();

  const queryResult = sdk.query({
    prompt,
    options: {
      cwd: workspaceDir,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: zeusContext,
      },
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      mcpServers: { magically: mcpServer },
      includePartialMessages: true,
      enableFileCheckpointing: true,
      persistSession: false,
      maxTurns: 30,
      maxBudgetUsd: 1.00,
      model: 'claude-sonnet-4-6',
      settingSources: [],
      ...(agentSessionId ? { resume: agentSessionId } : {}),
      ...(abortController ? { abortController } : {}),
    },
  });

  let fullResponse = '';
  let savedAgentSessionId = false;
  const orderedBlocks: ContentBlock[] = [];

  try {
    for await (const message of queryResult) {
      if (abortController?.signal.aborted) break;

      // Persist SDK session ID for resume
      if (!savedAgentSessionId && 'session_id' in message && message.session_id) {
        await zeus.updateConversationAgentSessionId(sessionId, message.session_id);
        savedAgentSessionId = true;
      }

      switch (message.type) {
        case 'stream_event': {
          const event = (message as { event?: { type: string; delta?: { type: string; text: string }; content_block?: { type: string; id: string; name: string } } }).event;
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
          const msg = message as { message?: { content?: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> }; parent_tool_use_id?: string | null };
          const contentBlocks = msg.message?.content ?? [];
          const parentId = msg.parent_tool_use_id ?? null;

          for (const block of contentBlocks) {
            if (block.type === 'text' && block.text) {
              fullResponse += block.text;
              orderedBlocks.push({ type: 'text', text: block.text, parentToolUseId: parentId });
              callbacks.onChunk?.(fullResponse);
            }
            if (block.type === 'tool_use') {
              orderedBlocks.push({ type: 'tool_use', id: block.id, tool: block.name, input: block.input, status: 'running', parentToolUseId: parentId });
              callbacks.onToolStart?.(block.id!, block.name!, block.input);
            }
          }
          break;
        }

        case 'user': {
          const userMsg = message as { tool_use_result?: unknown; message?: { content?: Array<{ type: string; tool_use_id?: string; content?: unknown }> } };
          if (userMsg.tool_use_result !== undefined) {
            const msgContent = userMsg.message?.content;
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
          const sysMsg = message as { subtype?: string; status?: string };
          if (sysMsg.subtype === 'status' && sysMsg.status) {
            callbacks.onStatus?.(sysMsg.status);
          }
          break;
        }

        case 'result': {
          const r = message as { subtype?: string; result?: string; total_cost_usd?: number; num_turns?: number; duration_ms?: number; modelUsage?: Record<string, unknown>; errors?: string[] };
          if (r.subtype === 'success' && r.result && !fullResponse) {
            fullResponse = r.result;
            callbacks.onChunk?.(fullResponse);
          }
          callbacks.onResult?.({
            cost: r.total_cost_usd ?? 0,
            turns: r.num_turns ?? 0,
            durationMs: r.duration_ms ?? 0,
            usage: r.modelUsage ?? null,
          });
          if (r.subtype !== 'success') {
            callbacks.onError?.(r.errors?.join('; ') ?? r.subtype ?? 'Unknown error');
          }
          break;
        }
      }
    }

    callbacks.onDone?.();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks.onError?.(message);
  }

  return { fullResponse, blocks: orderedBlocks };
}
