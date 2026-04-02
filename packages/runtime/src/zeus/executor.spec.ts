/**
 * Tests for executor persistence behavior.
 * Verifies that messages are persisted at correct semantic boundaries
 * (assistant events, tool results, completion) — not on every text delta.
 */

jest.mock('./tools', () => ({
  createMagicallyMcpServer: jest.fn().mockResolvedValue({}),
}));

// Import SdkMessage type for properly typed test data
import type { SdkMessage, ExecutionOptions, ContentBlock, ExecutionCallbacks, ExecutorZeusDelegate, ExecutorAgentsDelegate, ChatConfig } from './executor';
import { TOP_LEVEL_CHAT_CONFIG, AGENT_SCOPED_CHAT_CONFIG } from './executor';

let mockQueryIterator: AsyncIterable<SdkMessage>;

jest.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: jest.fn(() => mockQueryIterator),
}));

// Must import after mocks are set up
const { executePrompt } = jest.requireActual('./executor') as typeof import('./executor');

function asyncIterableFrom(items: SdkMessage[]): AsyncIterable<SdkMessage> {
  return {
    [Symbol.asyncIterator]: () => {
      let index = 0;
      return {
        next: async (): Promise<IteratorResult<SdkMessage>> => {
          if (index < items.length) {
            return { value: items[index++], done: false };
          }
          return { value: undefined as never, done: true };
        },
      };
    },
  };
}

function throwingAsyncIterable(items: SdkMessage[], errorAfter: number): AsyncIterable<SdkMessage> {
  return {
    [Symbol.asyncIterator]: () => {
      let index = 0;
      return {
        next: async (): Promise<IteratorResult<SdkMessage>> => {
          if (index >= errorAfter) throw new Error('SDK crashed');
          if (index < items.length) {
            return { value: items[index++], done: false };
          }
          return { value: undefined as never, done: true };
        },
      };
    },
  };
}

type MockedZeus = { [K in keyof ExecutorZeusDelegate]: jest.Mock };
type MockedAgents = { [K in keyof ExecutorAgentsDelegate]: jest.Mock };

function makeZeusMock(): MockedZeus {
  return {
    ensureWorkspace: jest.fn().mockResolvedValue('/tmp/workspace'),
    buildZeusContext: jest.fn().mockResolvedValue('test context'),
    updateMessage: jest.fn().mockResolvedValue(undefined),
    updateConversationAgentSessionId: jest.fn().mockResolvedValue(undefined),
    getMemory: jest.fn().mockResolvedValue([]),
    setMemory: jest.fn().mockResolvedValue(undefined),
    deleteMemory: jest.fn().mockResolvedValue(undefined),
    createTask: jest.fn().mockResolvedValue('task-1'),
    getTasks: jest.fn().mockResolvedValue([]),
  };
}

function makeAgentsMock(): MockedAgents {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue({ id: 'test', name: 'Test', description: null, icon: null, color: null, category: null, status: 'live', latestVersion: '1.0.0', manifest: {}, enabled: true }),
  };
}

function makeCallbacks(): Record<keyof ExecutionCallbacks, jest.Mock> {
  return {
    onChunk: jest.fn(),
    onToolStart: jest.fn(),
    onToolResult: jest.fn(),
    onStatus: jest.fn(),
    onResult: jest.fn(),
    onError: jest.fn(),
    onDone: jest.fn(),
  };
}

function baseOptions() {
  const zeus = makeZeusMock();
  const agents = makeAgentsMock();
  const callbacks = makeCallbacks();
  const opts: ExecutionOptions = {
    sessionId: 'session-1',
    prompt: 'Hello',
    userId: 'user-1',
    assistantMsgId: 'msg-1',
    callbacks,
    zeus,
    agents,
  };
  return { opts, zeus, callbacks };
}

describe('executePrompt persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does NOT persist on individual text deltas', async () => {
    mockQueryIterator = asyncIterableFrom([
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } } },
      { type: 'result', subtype: 'success', total_cost_usd: 0.01, num_turns: 1, duration_ms: 100 },
    ]);

    const { opts, zeus } = baseOptions();
    await executePrompt(opts);

    // Should only persist once — at final completion, NOT on each delta
    expect(zeus.updateMessage).toHaveBeenCalledTimes(1);
  });

  it('persists on assistant message events (SDK batch boundary)', async () => {
    mockQueryIterator = asyncIterableFrom([
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } },
      { type: 'result', subtype: 'success', total_cost_usd: 0.01, num_turns: 1, duration_ms: 100 },
    ]);

    const { opts, zeus } = baseOptions();
    await executePrompt(opts);

    // Should persist: 1) on assistant event, 2) on final completion
    expect(zeus.updateMessage).toHaveBeenCalledTimes(2);
  });

  it('persists on tool result events', async () => {
    mockQueryIterator = asyncIterableFrom([
      { type: 'stream_event', event: { type: 'content_block_start', content_block: { type: 'tool_use', id: 't1', name: 'Read' } } },
      { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/test' } }] } },
      { type: 'user', tool_use_result: true, message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'file contents' }] } },
      { type: 'result', subtype: 'success', total_cost_usd: 0.02, num_turns: 1, duration_ms: 200 },
    ]);

    const { opts, zeus } = baseOptions();
    await executePrompt(opts);

    // Should persist: 1) assistant event, 2) tool result, 3) final
    expect(zeus.updateMessage).toHaveBeenCalledTimes(3);

    // Verify tool result persistence includes done status
    // updateMessage(assistantMsgId, content, blocks) — blocks at index 2
    const toolResultCall = zeus.updateMessage.mock.calls[1];
    const blocks = toolResultCall[2] as ContentBlock[];
    const toolBlock = blocks.find((b: ContentBlock) => b.type === 'tool_use' && b.id === 't1');
    expect(toolBlock?.status).toBe('done');
    expect(toolBlock?.result).toBe('file contents');
  });

  it('persists partial state on error', async () => {
    mockQueryIterator = throwingAsyncIterable([
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'partial' } } },
    ], 1);

    const { opts, zeus, callbacks } = baseOptions();
    await executePrompt(opts);

    expect(zeus.updateMessage).toHaveBeenCalled();
    const lastCall = zeus.updateMessage.mock.calls[zeus.updateMessage.mock.calls.length - 1];
    // updateMessage(assistantMsgId, content, blocks) — second arg is content
    expect(lastCall[1]).toBe('partial');
    expect(callbacks.onError).toHaveBeenCalled();
  });

  it('logs persistence errors instead of swallowing them', async () => {
    mockQueryIterator = asyncIterableFrom([
      { type: 'assistant', message: { content: [{ type: 'text', text: 'Hello' }] } },
      { type: 'result', subtype: 'success', total_cost_usd: 0.01, num_turns: 1, duration_ms: 100 },
    ]);

    const { opts, zeus, callbacks } = baseOptions();
    zeus.updateMessage.mockRejectedValueOnce(new Error('Connection lost'));

    // Should not throw — error is logged, execution continues
    await expect(executePrompt(opts)).resolves.toBeDefined();
    // onDone should still be called even if persistence fails
    expect(callbacks.onDone).toHaveBeenCalled();
  });

  it('calls onChunk on every text delta for real-time streaming', async () => {
    mockQueryIterator = asyncIterableFrom([
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } } },
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } } },
      { type: 'result', subtype: 'success', total_cost_usd: 0.01, num_turns: 1, duration_ms: 100 },
    ]);

    const { opts, callbacks } = baseOptions();
    await executePrompt(opts);

    // Real-time callbacks still fire on every delta — only DB persistence is batched
    expect(callbacks.onChunk).toHaveBeenCalledTimes(2);
    expect(callbacks.onChunk).toHaveBeenNthCalledWith(1, 'Hello');
    expect(callbacks.onChunk).toHaveBeenNthCalledWith(2, 'Hello world');
  });

  it('persists SDK session ID for resume', async () => {
    mockQueryIterator = asyncIterableFrom([
      { type: 'stream_event', session_id: 'sdk-session-123', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } } },
      { type: 'result', subtype: 'success', total_cost_usd: 0.01, num_turns: 1, duration_ms: 100 },
    ]);

    const { opts, zeus } = baseOptions();
    await executePrompt(opts);

    expect(zeus.updateConversationAgentSessionId).toHaveBeenCalledWith('session-1', 'sdk-session-123');
  });
});

describe('ChatConfig presets', () => {
  it('TOP_LEVEL_CHAT_CONFIG has full tool access', () => {
    expect(TOP_LEVEL_CHAT_CONFIG.tools).toContain('Bash');
    expect(TOP_LEVEL_CHAT_CONFIG.tools).toContain('Write');
    expect(TOP_LEVEL_CHAT_CONFIG.tools).toContain('Edit');
    expect(TOP_LEVEL_CHAT_CONFIG.tools).toContain('Read');
    expect(TOP_LEVEL_CHAT_CONFIG.tools).toContain('WebSearch');
    expect(TOP_LEVEL_CHAT_CONFIG.includeMcpTools).toBe(true);
  });

  it('AGENT_SCOPED_CHAT_CONFIG restricts tools', () => {
    expect(AGENT_SCOPED_CHAT_CONFIG.tools).toContain('Read');
    expect(AGENT_SCOPED_CHAT_CONFIG.tools).not.toContain('Bash');
    expect(AGENT_SCOPED_CHAT_CONFIG.tools).not.toContain('Write');
    expect(AGENT_SCOPED_CHAT_CONFIG.includeMcpTools).toBe(false);
  });

  it('TOP_LEVEL has higher budget than AGENT_SCOPED', () => {
    expect(TOP_LEVEL_CHAT_CONFIG.maxBudgetUsd).toBeGreaterThan(AGENT_SCOPED_CHAT_CONFIG.maxBudgetUsd);
  });

  it('both have required fields', () => {
    for (const config of [TOP_LEVEL_CHAT_CONFIG, AGENT_SCOPED_CHAT_CONFIG]) {
      expect(config.model).toBeDefined();
      expect(config.maxTurns).toBeGreaterThan(0);
      expect(config.maxBudgetUsd).toBeGreaterThan(0);
      expect(config.tools.length).toBeGreaterThan(0);
    }
  });
});

describe('executePrompt with ChatConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes config tools to SDK query', async () => {
    const sdk = require('@anthropic-ai/claude-agent-sdk');

    mockQueryIterator = asyncIterableFrom([
      { type: 'result', subtype: 'success', total_cost_usd: 0.01, num_turns: 1, duration_ms: 100 },
    ]);

    const { opts } = baseOptions();
    opts.chatConfig = {
      tools: ['Read', 'Glob'],
      model: 'claude-haiku-4-5',
      maxTurns: 5,
      maxBudgetUsd: 0.10,
      includeMcpTools: false,
    };
    await executePrompt(opts);

    const queryCall = sdk.query.mock.calls[0][0];
    expect(queryCall.options.tools).toEqual(['Read', 'Glob']);
    expect(queryCall.options.model).toBe('claude-haiku-4-5');
    expect(queryCall.options.maxTurns).toBe(5);
    expect(queryCall.options.maxBudgetUsd).toBe(0.10);
  });

  it('uses default config when none provided', async () => {
    const sdk = require('@anthropic-ai/claude-agent-sdk');

    mockQueryIterator = asyncIterableFrom([
      { type: 'result', subtype: 'success', total_cost_usd: 0.01, num_turns: 1, duration_ms: 100 },
    ]);

    const { opts } = baseOptions();
    await executePrompt(opts);

    const queryCall = sdk.query.mock.calls[0][0];
    // Default is TOP_LEVEL_CHAT_CONFIG
    expect(queryCall.options.tools).toContain('Bash');
    expect(queryCall.options.model).toBe('claude-sonnet-4-6');
    expect(queryCall.options.maxTurns).toBe(30);
  });
});
