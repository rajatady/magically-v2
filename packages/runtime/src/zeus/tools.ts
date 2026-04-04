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

      sdk.tool(
        'ReadFeed',
        'Read recent feed events from all agents. Feed events include alerts, status updates, analytics, and errors emitted by agents during execution. Use this to understand what agents have been doing and surface insights to the user.',
        {
          limit: z.number().optional().describe('Number of events to fetch (default 20)'),
        },
        async (args) => {
          const events = await deps.zeus.getFeed(args.limit ?? 20);
          if (events.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No feed events yet.' }] };
          }
          const lines = events.map((e) => {
            const agent = e.agentId ?? 'system';
            const data = e.data ? ` | data: ${JSON.stringify(e.data)}` : '';
            return `[${e.type}] ${agent}: ${e.title}${e.body ? ' — ' + e.body : ''}${data} (${e.createdAt})`;
          });
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        },
      ),

      sdk.tool(
        'ReadWidgets',
        'Read all active widgets on the user\'s home screen. Each widget contains HTML rendered by an agent showing its current state — analytics, status, alerts. Use this to understand what the user sees and reason about cross-agent insights.',
        {},
        async () => {
          const widgets = await deps.zeus.getWidgets(deps.userId);
          if (widgets.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No widgets on home screen.' }] };
          }
          const lines = widgets.map((w) =>
            `[${w.agentId}] size=${w.size} updated=${w.updatedAt}\n${w.html}`,
          );
          return { content: [{ type: 'text' as const, text: lines.join('\n\n---\n\n') }] };
        },
      ),
    ],
  });
}
