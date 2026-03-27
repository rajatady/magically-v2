import { describe, it, expect, vi } from 'vitest';
import { createSearchMemoryTool } from './search-memory';

const mockMemory = [
  { id: '1', key: 'user.name', value: 'Rajat', category: 'profile', confidence: 1, source: 'user', expiresAt: null, createdAt: new Date(), updatedAt: new Date() },
  { id: '2', key: 'user.timezone', value: 'Asia/Kolkata', category: 'profile', confidence: 0.9, source: 'inferred', expiresAt: null, createdAt: new Date(), updatedAt: new Date() },
  { id: '3', key: 'pref.theme', value: 'dark', category: 'preferences', confidence: 1, source: 'user', expiresAt: null, createdAt: new Date(), updatedAt: new Date() },
];

describe('searchMemory tool', () => {
  it('returns all memories when no query provided', async () => {
    const tool = createSearchMemoryTool({ getMemory: vi.fn().mockResolvedValue(mockMemory) });
    const result = await tool.execute!({ query: '' }, {} as never);
    expect(result).toHaveProperty('memories');
    expect((result as { memories: unknown[] }).memories).toHaveLength(3);
  });

  it('filters by query substring match on key or value', async () => {
    const tool = createSearchMemoryTool({ getMemory: vi.fn().mockResolvedValue(mockMemory) });
    const result = await tool.execute!({ query: 'timezone' }, {} as never);
    const memories = (result as { memories: unknown[] }).memories;
    expect(memories).toHaveLength(1);
  });

  it('filters by category when provided', async () => {
    const tool = createSearchMemoryTool({ getMemory: vi.fn().mockResolvedValue(mockMemory) });
    const result = await tool.execute!({ query: '', category: 'preferences' }, {} as never);
    const memories = (result as { memories: unknown[] }).memories;
    expect(memories).toHaveLength(1);
  });

  it('returns empty array when nothing matches', async () => {
    const tool = createSearchMemoryTool({ getMemory: vi.fn().mockResolvedValue(mockMemory) });
    const result = await tool.execute!({ query: 'nonexistent' }, {} as never);
    expect((result as { memories: unknown[] }).memories).toHaveLength(0);
  });
});
