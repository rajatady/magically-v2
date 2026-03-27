import { describe, it, expect, vi } from 'vitest';
import { createWriteMemoryTool } from './write-memory';

describe('writeMemory tool', () => {
  it('calls setMemory with the provided key, value, category', async () => {
    const setMemory = vi.fn().mockResolvedValue(undefined);
    const tool = createWriteMemoryTool({ setMemory });

    const result = await tool.execute!({
      key: 'user.name',
      value: 'Rajat',
      category: 'profile',
    }, {} as never);

    expect(setMemory).toHaveBeenCalledWith('user.name', 'Rajat', 'profile', 'zeus');
    expect(result).toEqual({ stored: true, key: 'user.name' });
  });

  it('defaults category to "general" when not provided', async () => {
    const setMemory = vi.fn().mockResolvedValue(undefined);
    const tool = createWriteMemoryTool({ setMemory });

    await tool.execute!({ key: 'fact', value: 'sky is blue' }, {} as never);
    expect(setMemory).toHaveBeenCalledWith('fact', 'sky is blue', 'general', 'zeus');
  });

  it('returns error object when setMemory throws', async () => {
    const setMemory = vi.fn().mockRejectedValue(new Error('DB down'));
    const tool = createWriteMemoryTool({ setMemory });

    const result = await tool.execute!({ key: 'x', value: 'y' }, {} as never);
    expect(result).toEqual({ error: 'DB down' });
  });
});
