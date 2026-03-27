import { describe, expect, it, vi } from 'vitest';
import type { AgentSummary } from '../../lib/api';
import { filterWidgetAgents, getGreeting } from './HomeView.logic';

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
  return {
    id: 'a1',
    name: 'Agent',
    icon: '◇',
    enabled: true,
    version: '1.0.0',
    hasWidget: true,
    functions: [],
    ...overrides,
  };
}

describe('filterWidgetAgents', () => {
  it('returns only enabled agents with widgets', () => {
    const agents = [
      makeAgent({ id: 'a', hasWidget: true, enabled: true }),
      makeAgent({ id: 'b', hasWidget: false, enabled: true }),
      makeAgent({ id: 'c', hasWidget: true, enabled: false }),
    ];
    const result = filterWidgetAgents(agents);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty array when no agents match', () => {
    expect(filterWidgetAgents([])).toHaveLength(0);
    expect(filterWidgetAgents([makeAgent({ hasWidget: false })])).toHaveLength(0);
  });
});

describe('getGreeting', () => {
  it('returns a valid greeting string', () => {
    const result = getGreeting();
    expect(['Good morning', 'Good afternoon', 'Good evening']).toContain(result);
  });
});
