import { describe, it, expect, vi } from 'vitest';
import { createListAgentsTool } from './list-agents';

const mockAgents = [
  { id: 'grocery', name: 'Grocery List', description: 'Manage groceries', icon: '🛒', functions: ['addItem', 'listItems'] },
  { id: 'calendar', name: 'Calendar', description: 'Schedule events', icon: '📅', functions: ['createEvent'] },
];

describe('listAgents tool', () => {
  it('returns agents with their functions', async () => {
    const tool = createListAgentsTool({ findAll: vi.fn().mockResolvedValue(mockAgents) });
    const result = await tool.execute!({}, {} as never) as { agents: unknown[] };
    expect(result.agents).toHaveLength(2);
  });

  it('includes agent id, name, description, and function names', async () => {
    const tool = createListAgentsTool({ findAll: vi.fn().mockResolvedValue(mockAgents) });
    const result = await tool.execute!({}, {} as never) as { agents: Array<{ id: string; functions: string[] }> };
    const grocery = result.agents.find((a) => a.id === 'grocery');
    expect(grocery).toBeDefined();
    expect(grocery!.functions).toEqual(['addItem', 'listItems']);
  });
});
