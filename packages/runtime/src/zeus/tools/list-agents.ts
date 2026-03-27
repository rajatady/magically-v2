import { tool } from 'ai';
import { z } from 'zod';
import { safeExecute } from './create-tool';

interface AgentSummary {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  functions: string[];
}

interface ListAgentsDeps {
  findAll: () => Promise<AgentSummary[]>;
}

export const createListAgentsTool = (deps: ListAgentsDeps) =>
  tool({
    description:
      'List all installed and enabled agents with their available functions. ' +
      'Use this to discover what agents exist before routing a task.',
    inputSchema: z.object({}),
    execute: async () =>
      safeExecute('listAgents', async () => {
        const agents = await deps.findAll();
        return {
          agents: agents.map((a) => ({
            id: a.id,
            name: a.name,
            description: a.description ?? '',
            icon: a.icon ?? '',
            functions: a.functions,
          })),
        };
      }),
  });
