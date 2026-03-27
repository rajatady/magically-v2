import type { MemoryEntry } from '../../db/schema';
import { createSearchMemoryTool } from './search-memory';
import { createWriteMemoryTool } from './write-memory';
import { createListAgentsTool } from './list-agents';

export interface ZeusToolDeps {
  getMemory: () => Promise<MemoryEntry[]>;
  setMemory: (key: string, value: string, category: string, source: string) => Promise<void>;
  findAllAgents: () => Promise<Array<{
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    functions: string[];
  }>>;
}

export function createZeusTools(deps: ZeusToolDeps) {
  return {
    searchMemory: createSearchMemoryTool({ getMemory: deps.getMemory }),
    writeMemory: createWriteMemoryTool({ setMemory: deps.setMemory }),
    listAgents: createListAgentsTool({ findAll: deps.findAllAgents }),
  };
}
