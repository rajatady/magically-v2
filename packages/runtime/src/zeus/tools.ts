/**
 * MCP server exposing Magically services as tools for the Agent SDK.
 * Same pattern as cc-harness cron.tools.ts — lazy-load SDK to avoid
 * top-level import issues.
 */
import type { ExecutorAgentsDelegate, ExecutorZeusDelegate } from './executor';

export interface MagicallyToolsDeps {
  agents: ExecutorAgentsDelegate;
  zeus: ExecutorZeusDelegate;
  userId: string;
}

export async function createMagicallyMcpServer(deps: MagicallyToolsDeps) {
  const sdk = await import('@anthropic-ai/claude-agent-sdk');
  const { z } = await import('zod');

  return sdk.createSdkMcpServer({
    name: 'magically',
    version: '1.0.0',
    tools: [
      sdk.tool(
        'ListAgents',
        'List all installed agents with their IDs, names, descriptions, and available functions.',
        {},
        async () => {
          const agents = await deps.agents.findAll();
          if (agents.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No agents installed yet.' }] };
          }
          const lines = agents.map((a) => {
            const desc = a.description ?? 'No description';
            return `- ${a.id}: ${a.name} (v${a.latestVersion}) — ${desc}`;
          });
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        },
      ),

      sdk.tool(
        'GetAgent',
        'Get detailed information about a specific agent including its manifest.',
        { id: z.string().describe('The agent ID') },
        async (args) => {
          try {
            const agent = await deps.agents.findOne(args.id);
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  id: agent.id,
                  name: agent.name,
                  version: agent.latestVersion,
                  description: agent.description,
                  enabled: agent.enabled,
                  manifest: agent.manifest,
                }, null, 2),
              }],
            };
          } catch {
            return { content: [{ type: 'text' as const, text: `Agent '${args.id}' not found.` }] };
          }
        },
      ),

      sdk.tool(
        'ReadMemory',
        'Read all stored memory entries. Memory contains user preferences, facts, and context that persists across conversations.',
        {},
        async () => {
          const entries = await deps.zeus.getMemory();
          if (entries.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No memory entries stored yet.' }] };
          }
          const lines = entries.map((e) =>
            `[${e.category}] ${e.key}: ${e.value} (source: ${e.source})`,
          );
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        },
      ),

      sdk.tool(
        'WriteMemory',
        'Store a memory entry. Use this to remember user preferences, facts, or context for future conversations. Updates existing entries with the same key.',
        {
          key: z.string().describe('Unique key for the memory entry (e.g., "user.name", "pref.theme")'),
          value: z.string().describe('The value to store'),
          category: z.string().describe('Category: "user", "preference", "context", or "fact"'),
        },
        async (args) => {
          await deps.zeus.setMemory(args.key, args.value, args.category, 'zeus');
          return { content: [{ type: 'text' as const, text: `Stored memory: ${args.key} = ${args.value}` }] };
        },
      ),

      sdk.tool(
        'DeleteMemory',
        'Delete a memory entry by key.',
        { key: z.string().describe('The key to delete') },
        async (args) => {
          await deps.zeus.deleteMemory(args.key);
          return { content: [{ type: 'text' as const, text: `Deleted memory: ${args.key}` }] };
        },
      ),

      sdk.tool(
        'CreateTask',
        'Create a task for tracking work. Tasks can be assigned to agents or handled by Zeus.',
        {
          goal: z.string().describe('What needs to be done'),
          priority: z.string().optional().describe('"low", "normal", or "high"'),
          requesterId: z.string().optional().describe('Agent ID requesting the task, or "user"'),
        },
        async (args) => {
          const validPriorities = ['low', 'normal', 'high'] as const;
          const priority = validPriorities.includes(args.priority as typeof validPriorities[number])
            ? args.priority as typeof validPriorities[number]
            : 'normal';
          const id = await deps.zeus.createTask({
            requesterId: args.requesterId ?? deps.userId,
            goal: args.goal,
            priority,
          });
          return { content: [{ type: 'text' as const, text: `Created task ${id}: ${args.goal}` }] };
        },
      ),

      sdk.tool(
        'ListTasks',
        'List all tasks sorted by most recent first.',
        {},
        async () => {
          const tasks = await deps.zeus.getTasks();
          if (tasks.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No tasks.' }] };
          }
          const lines = tasks.map((t) =>
            `[${t.status}] ${t.goal} (priority: ${t.priority}, from: ${t.requesterId})`,
          );
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        },
      ),
    ],
  });
}
