import { describe, expect, it, vi } from 'vitest';
import { filterWidgetAgents, getGreeting } from './HomeView.logic';

function makeAgent(overrides: Record<string, unknown> = {}) {
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
    const result = filterWidgetAgents(agents as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty array when no agents match', () => {
    expect(filterWidgetAgents([])).toHaveLength(0);
    expect(filterWidgetAgents([makeAgent({ hasWidget: false })] as any)).toHaveLength(0);
  });
});

describe('getGreeting', () => {
  it('returns morning greeting before noon', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 27, 9, 0));
    expect(getGreeting()).toBe('Good morning');
    vi.useRealTimers();
  });

  it('returns afternoon greeting between noon and 6pm', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 27, 14, 0));
    expect(getGreeting()).toBe('Good afternoon');
    vi.useRealTimers();
  });

  it('returns evening greeting after 6pm', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 27, 20, 0));
    expect(getGreeting()).toBe('Good evening');
    vi.useRealTimers();
  });
});
