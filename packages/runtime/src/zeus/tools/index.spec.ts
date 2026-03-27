import { describe, it, expect, vi } from 'vitest';
import { createZeusTools } from './index';

describe('createZeusTools', () => {
  it('returns a record of all Zeus chat tools', () => {
    const tools = createZeusTools({
      getMemory: vi.fn(),
      setMemory: vi.fn(),
      findAllAgents: vi.fn(),
    });

    expect(Object.keys(tools)).toContain('searchMemory');
    expect(Object.keys(tools)).toContain('writeMemory');
    expect(Object.keys(tools)).toContain('listAgents');
    // Every value should have a description and execute
    for (const tool of Object.values(tools)) {
      expect(tool.description).toBeTruthy();
      expect(typeof tool.execute).toBe('function');
    }
  });
});
