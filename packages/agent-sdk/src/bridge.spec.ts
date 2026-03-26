/**
 * BridgeClient tests — runs in jsdom environment.
 * We simulate the parent window ↔ iframe message exchange manually.
 * Skipped under bun test (no DOM) — run via jest in agent-sdk package.
 */

// Skip when no DOM (bun test runs in node-like env)
const hasDom = typeof globalThis.window !== 'undefined';

import { BridgeClient } from './bridge.js';

// Helper: create a mock "parent window" that echoes back responses
function setupMockParent(respondWith: { data?: unknown; error?: string }) {
  const posted: MessageEvent[] = [];

  // Intercept window.parent.postMessage
  Object.defineProperty(window, 'parent', {
    value: {
      postMessage: (msg: unknown) => {
        // Simulate the runtime responding
        const incoming = msg as { id: string; __magically: boolean };
        if (!incoming.__magically) return;

        setTimeout(() => {
          const response = new MessageEvent('message', {
            data: {
              __magically: true,
              id: `resp-${incoming.id}`,
              direction: 'runtime→agent',
              type: 'RESPONSE',
              requestId: incoming.id,
              ...respondWith,
            },
          });
          window.dispatchEvent(response);
        }, 0);

        posted.push(msg as MessageEvent);
      },
    },
    writable: true,
    configurable: true,
  });

  return posted;
}

const maybeDescribe = hasDom ? describe : describe.skip;

maybeDescribe('BridgeClient', () => {
  let client: BridgeClient;

  beforeEach(() => {
    client = new BridgeClient('test-agent');
  });

  afterEach(() => {
    client.destroy();
  });

  it('sends a message and resolves with the response data', async () => {
    setupMockParent({ data: { events: [{ id: '1', title: 'Standup' }] } });

    const result = await client.send({
      type: 'GET_DATA',
      endpoint: '/widget-data',
    });

    expect(result).toEqual({ events: [{ id: '1', title: 'Standup' }] });
  });

  it('rejects the promise when runtime returns an error', async () => {
    setupMockParent({ error: 'Tool not found' });

    await expect(
      client.send({ type: 'CALL_TOOL', toolId: 'nonexistent', params: {} }),
    ).rejects.toThrow('Tool not found');
  });

  it('on() registers and calls event listeners', () => {
    const handler = jest.fn();
    client.on('agent:refresh', handler);

    const event = new MessageEvent('message', {
      data: {
        __magically: true,
        id: 'evt-1',
        direction: 'runtime→agent',
        type: 'EVENT',
        event: 'agent:refresh',
        data: { timestamp: 12345 },
      },
    });
    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith({ timestamp: 12345 });
  });

  it('on() returns an unsubscribe function that stops delivery', () => {
    const handler = jest.fn();
    const unsubscribe = client.on('test:event', handler);
    unsubscribe();

    const event = new MessageEvent('message', {
      data: {
        __magically: true,
        id: 'evt-2',
        direction: 'runtime→agent',
        type: 'EVENT',
        event: 'test:event',
        data: {},
      },
    });
    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores messages not marked with __magically', () => {
    const handler = jest.fn();
    client.on('some:event', handler);

    window.dispatchEvent(
      new MessageEvent('message', { data: { type: 'EVENT', event: 'some:event' } }),
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
