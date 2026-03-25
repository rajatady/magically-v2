// ─── postMessage Bridge Protocol ────────────────────────────────────────────
// Messages sent from the agent iframe → runtime (via parent window)
// and from runtime → agent iframe

export type MessageDirection = 'agent→runtime' | 'runtime→agent';

export interface BridgeMessage {
  __magically: true;
  id: string;
  direction: MessageDirection;
}

// Agent → Runtime
export interface AgentCallToolMessage extends BridgeMessage {
  direction: 'agent→runtime';
  type: 'CALL_TOOL';
  toolId: string;
  params: Record<string, unknown>;
}

export interface AgentGetDataMessage extends BridgeMessage {
  direction: 'agent→runtime';
  type: 'GET_DATA';
  endpoint: string;
}

export interface AgentPostFeedMessage extends BridgeMessage {
  direction: 'agent→runtime';
  type: 'POST_FEED';
  item: {
    type: 'info' | 'success' | 'warning' | 'error' | 'audio';
    title: string;
    body?: string;
    audioUrl?: string;
  };
}

export interface AgentReadMemoryMessage extends BridgeMessage {
  direction: 'agent→runtime';
  type: 'READ_MEMORY';
  keys: string[];
}

export interface AgentWriteMemoryMessage extends BridgeMessage {
  direction: 'agent→runtime';
  type: 'WRITE_MEMORY';
  key: string;
  value: string;
  category: string;
}

export interface AgentNavigateMessage extends BridgeMessage {
  direction: 'agent→runtime';
  type: 'NAVIGATE';
  agentId: string;
}

export interface AgentCreateZeusTaskMessage extends BridgeMessage {
  direction: 'agent→runtime';
  type: 'CREATE_ZEUS_TASK';
  goal: string;
  context?: unknown;
  deliverables?: string[];
  priority?: 'low' | 'normal' | 'high';
  requiresApproval?: boolean;
}

export type AgentToRuntimeMessage =
  | AgentCallToolMessage
  | AgentGetDataMessage
  | AgentPostFeedMessage
  | AgentReadMemoryMessage
  | AgentWriteMemoryMessage
  | AgentNavigateMessage
  | AgentCreateZeusTaskMessage;

// Runtime → Agent
export interface RuntimeResponseMessage extends BridgeMessage {
  direction: 'runtime→agent';
  type: 'RESPONSE';
  requestId: string;
  data?: unknown;
  error?: string;
}

export interface RuntimeEventMessage extends BridgeMessage {
  direction: 'runtime→agent';
  type: 'EVENT';
  event: string;
  data: unknown;
}

export type RuntimeToAgentMessage = RuntimeResponseMessage | RuntimeEventMessage;
export type AnyBridgeMessage = AgentToRuntimeMessage | RuntimeToAgentMessage;

// ─── Agent SDK Context ────────────────────────────────────────────────────────

export interface AgentContext {
  agentId: string;
  runtimeUrl: string;
}
