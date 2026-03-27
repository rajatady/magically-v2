import type { UIMessage, DataUIPart } from 'ai';

/**
 * Custom data event types Zeus can stream alongside text.
 * Currently a placeholder — ready for when Zeus emits agent-routing,
 * memory-write, task-created events.
 */
export type ZeusDataTypes = {
  'agent-routing': { agentId: string; agentName: string };
  'memory-write': { key: string; value: string };
  'task-created': { taskId: string; goal: string };
};

export type ZeusMessage = UIMessage;
export type ZeusDataPart = DataUIPart<ZeusDataTypes>;
