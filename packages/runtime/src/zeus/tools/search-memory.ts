import { tool } from 'ai';
import { z } from 'zod';
import type { MemoryEntry } from '../../db/schema';
import { safeExecute } from './create-tool';

interface SearchMemoryDeps {
  getMemory: () => Promise<MemoryEntry[]>;
}

export const createSearchMemoryTool = (deps: SearchMemoryDeps) =>
  tool({
    description:
      'Search your memory about the user — preferences, facts, context you previously stored. ' +
      'Use this before asking the user something you might already know.',
    inputSchema: z.object({
      query: z.string().describe('Search term to match against memory keys and values. Empty string returns all.'),
      category: z.string().optional().describe('Filter by category (e.g. "profile", "preferences", "context")'),
    }),
    execute: async ({ query, category }) =>
      safeExecute('searchMemory', async () => {
        const all = await deps.getMemory();
        const q = query.toLowerCase();

        const memories = all.filter((m) => {
          if (category && m.category !== category) return false;
          if (!q) return true;
          return m.key.toLowerCase().includes(q) || m.value.toLowerCase().includes(q);
        });

        return {
          memories: memories.map((m) => ({
            key: m.key,
            value: m.value,
            category: m.category,
            source: m.source,
          })),
        };
      }),
  });
