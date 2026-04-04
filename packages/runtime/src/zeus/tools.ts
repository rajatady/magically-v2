/**
 * MCP server exposing Magically services as tools for the Agent SDK.
 * Same pattern as cc-harness cron.tools.ts — lazy-load SDK to avoid
 * top-level import issues.
 */
import type { ExecutorAgentsDelegate, ExecutorZeusDelegate } from './executor';
import type { LocalRunnerService } from '../agents/local-runner.service';
import type { LocalDiscoveryService } from '../agents/local-discovery.service';

export interface MagicallyToolsDeps {
  agents: ExecutorAgentsDelegate;
  zeus: ExecutorZeusDelegate;
  localRunner: LocalRunnerService | null;
  localDiscovery: LocalDiscoveryService | null;
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

      sdk.tool(
        'ListLocalAgents',
        'List all local agents available on the filesystem. These can be run directly without publishing.',
        {},
        async () => {
          const runner = deps.localRunner;
          if (!runner) return { content: [{ type: 'text' as const, text: 'Local runner not available.' }] };
          const agentIds = runner.listAgents();
          if (agentIds.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No local agents found.' }] };
          }
          const lines = agentIds.map((id) => {
            const manifest = runner.loadManifest(id);
            const fns = manifest.functions.map((f) => f.name).join(', ');
            return `- ${id}: ${manifest.name} — functions: [${fns}]`;
          });
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        },
      ),

      sdk.tool(
        'RunAgent',
        'Run a local agent function. The agent runs in-process, emits feed events and widgets, and returns the result. Use this to trigger agent work on behalf of the user.',
        {
          agentId: z.string().describe('Agent ID (directory name in agents/)'),
          functionName: z.string().describe('Function to run (declared in manifest)'),
          payload: z.record(z.unknown()).optional().describe('Optional JSON payload to pass to the function'),
        },
        async (args) => {
          const runner = deps.localRunner;
          if (!runner) return { content: [{ type: 'text' as const, text: 'Local runner not available.' }] };
          try {
            const result = await runner.run(args.agentId, args.functionName, deps.userId, args.payload);
            const summary = result.status === 'success'
              ? `OK (${result.durationMs}ms)${result.result ? '\n' + JSON.stringify(result.result, null, 2) : ''}`
              : `FAILED (${result.durationMs}ms): ${result.error}`;
            return { content: [{ type: 'text' as const, text: summary }] };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { content: [{ type: 'text' as const, text: `Error: ${message}` }] };
          }
        },
      ),
      sdk.tool(
        'ListSchedules',
        'List all cron schedules for the current user. Shows which agent functions run automatically and when.',
        {},
        async () => {
          const schedules = await deps.zeus.getSchedules(deps.userId);
          if (schedules.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No schedules configured.' }] };
          }
          const lines = schedules.map((s) => {
            const status = s.enabled ? '✓' : '✗';
            const lastRun = s.lastRunAt ? ` (last: ${s.lastRunAt})` : '';
            return `[${status}] ${s.agentId}/${s.functionName} — "${s.cron}"${lastRun} (id: ${s.id})`;
          });
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        },
      ),

      sdk.tool(
        'CreateSchedule',
        'Create a cron schedule for an agent function. The function will run automatically on the specified cron schedule for this user.',
        {
          agentId: z.string().describe('Agent ID'),
          functionName: z.string().describe('Function to schedule'),
          cron: z.string().describe('Cron expression (e.g., "0 */6 * * *" for every 6 hours)'),
        },
        async (args) => {
          const result = await deps.zeus.createSchedule(deps.userId, args.agentId, args.functionName, args.cron);
          return { content: [{ type: 'text' as const, text: `Schedule created (${result.id}): ${args.agentId}/${args.functionName} "${args.cron}"` }] };
        },
      ),

      sdk.tool(
        'ToggleSchedule',
        'Enable or disable an existing schedule.',
        {
          scheduleId: z.string().describe('Schedule ID'),
          enabled: z.boolean().describe('true to enable, false to disable'),
        },
        async (args) => {
          await deps.zeus.toggleSchedule(args.scheduleId, args.enabled);
          return { content: [{ type: 'text' as const, text: `Schedule ${args.scheduleId} ${args.enabled ? 'enabled' : 'disabled'}.` }] };
        },
      ),

      sdk.tool(
        'DeleteSchedule',
        'Permanently delete a schedule.',
        {
          scheduleId: z.string().describe('Schedule ID'),
        },
        async (args) => {
          await deps.zeus.deleteSchedule(args.scheduleId);
          return { content: [{ type: 'text' as const, text: `Schedule ${args.scheduleId} deleted.` }] };
        },
      ),

      sdk.tool(
        'RegisterAgent',
        'Register a local agent from the filesystem into the database. Must be called before RunAgent for new agents. Reads the manifest.json from the agents directory.',
        {
          agentId: z.string().describe('Agent ID (directory name in agents/)'),
        },
        async (args) => {
          const discovery = deps.localDiscovery;
          if (!discovery) return { content: [{ type: 'text' as const, text: 'Local discovery not available.' }] };
          const registered = await discovery.register(args.agentId);
          if (!registered) {
            return { content: [{ type: 'text' as const, text: `Agent '${args.agentId}' not found on filesystem or manifest invalid.` }] };
          }
          return { content: [{ type: 'text' as const, text: `Agent '${args.agentId}' registered.` }] };
        },
      ),
    ],
  });
}
