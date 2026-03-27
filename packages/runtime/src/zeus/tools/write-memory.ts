import { tool } from 'ai';
import { z } from 'zod';
import { safeExecute } from './create-tool';

interface WriteMemoryDeps {
  setMemory: (key: string, value: string, category: string, source: string) => Promise<void>;
}

export const createWriteMemoryTool = (deps: WriteMemoryDeps) =>
  tool({
    description:
      'Store a fact, preference, or context about the user for future conversations. ' +
      'Use this when you learn something worth remembering — name, preferences, goals, recurring tasks.',
    inputSchema: z.object({
      key: z.string().describe('Dot-notation key (e.g. "user.name", "pref.language", "context.current_project")'),
      value: z.string().describe('The value to store'),
      category: z.string().optional().describe('Category: "profile", "preferences", "context", "general". Defaults to "general".'),
    }),
    execute: async ({ key, value, category }) =>
      safeExecute('writeMemory', async () => {
        await deps.setMemory(key, value, category ?? 'general', 'zeus');
        return { stored: true, key };
      }),
  });
