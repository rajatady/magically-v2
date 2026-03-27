/**
 * MCP server exposing Magically services as tools for the Agent SDK.
 * Same pattern as cc-harness cron.tools.ts — lazy-load SDK to avoid
 * top-level import issues.
 */
import type { AgentsService } from '../agents/agents.service';
import type { ZeusService } from './zeus.service';

// Lazy-loaded SDK functions — dynamic import() at runtime avoids CJS/ESM mismatch at compile time
let _createSdkMcpServer: Function;
let _tool: Function;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _z: any;

async function loadSdk() {
  if (!_createSdkMcpServer) {
    const sdk = await import('@anthropic-ai/claude-agent-sdk');
    _createSdkMcpServer = sdk.createSdkMcpServer;
    _tool = sdk.tool;
    const zod = await import('zod');
    _z = zod.z;
  }
}

export interface MagicallyToolsDeps {
  agents: AgentsService;
  zeus: ZeusService;
  userId: string;
}

export async function createMagicallyMcpServer(deps: MagicallyToolsDeps) {
  await loadSdk();
  const z = _z;

  return _createSdkMcpServer({
    name: 'magically',
    version: '1.0.0',
    tools: [
      // ─── Agent Operations ─────────────────────────────────────────

      _tool(
        'ListAgents',
        'List all installed agents with their IDs, names, descriptions, and available functions.',
        {},
        async () => {
          const agents = await deps.agents.findAll();
          if (agents.length === 0) {
            return { content: [{ type: 'text' as const, text: 'No agents installed yet.' }] };
          }
          const lines = agents.map((a) =>
            `- ${a.id}: ${a.name} (v${a.latestVersion}) — ${a.description ?? 'No description'}\n  Functions: ${a.manifest && typeof a.manifest === 'object' && 'functions' in a.manifest ? (a.manifest as { functions?: Array<{ name: string }> }).functions?.map((f) => f.name).join(', ') || 'none' : 'none'}`,
          );
          return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
        },
      ),

      _tool(
        'GetAgent',
        'Get detailed information about a specific agent including its manifest.',
        { id: z.string().describe('The agent ID') },
        async (args: { id: string }) => {
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

      // ─── Memory Operations ────────────────────────────────────────

      _tool(
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

      _tool(
        'WriteMemory',
        'Store a memory entry. Use this to remember user preferences, facts, or context for future conversations. Updates existing entries with the same key.',
        {
          key: z.string().describe('Unique key for the memory entry (e.g., "user.name", "pref.theme")'),
          value: z.string().describe('The value to store'),
          category: z.string().describe('Category: "user", "preference", "context", or "fact"'),
        },
        async (args: { key: string; value: string; category: string }) => {
          await deps.zeus.setMemory(args.key, args.value, args.category, 'zeus');
          return { content: [{ type: 'text' as const, text: `Stored memory: ${args.key} = ${args.value}` }] };
        },
      ),

      _tool(
        'DeleteMemory',
        'Delete a memory entry by key.',
        { key: z.string().describe('The key to delete') },
        async (args: { key: string }) => {
          await deps.zeus.deleteMemory(args.key);
          return { content: [{ type: 'text' as const, text: `Deleted memory: ${args.key}` }] };
        },
      ),

      // ─── Task Operations ──────────────────────────────────────────

      _tool(
        'CreateTask',
        'Create a task for tracking work. Tasks can be assigned to agents or handled by Zeus.',
        {
          goal: z.string().describe('What needs to be done'),
          priority: z.string().optional().describe('"low", "normal", or "high"'),
          requesterId: z.string().optional().describe('Agent ID requesting the task, or "user"'),
        },
        async (args: { goal: string; priority?: string; requesterId?: string }) => {
          const id = await deps.zeus.createTask({
            requesterId: args.requesterId ?? deps.userId,
            goal: args.goal,
            priority: (args.priority as 'low' | 'normal' | 'high') ?? 'normal',
          });
          return { content: [{ type: 'text' as const, text: `Created task ${id}: ${args.goal}` }] };
        },
      ),

      _tool(
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
