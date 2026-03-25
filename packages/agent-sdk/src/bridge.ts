import { randomUUID } from 'crypto';
import {
  AgentToRuntimeMessage,
  RuntimeToAgentMessage,
  BridgeMessage,
} from './types.js';

type PendingRequest = {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
};

/**
 * BridgeClient — runs inside the agent iframe.
 * Sends typed messages to the parent window (runtime bridge) and
 * awaits responses by correlating request/response IDs.
 */
export class BridgeClient {
  private pending = new Map<string, PendingRequest>();
  private listeners = new Map<string, Array<(data: unknown) => void>>();

  constructor(private readonly agentId: string) {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleIncoming.bind(this));
    }
  }

  private handleIncoming(event: MessageEvent) {
    const msg = event.data as RuntimeToAgentMessage;
    if (!msg?.__magically) return;
    if (msg.direction !== 'runtime→agent') return;

    if (msg.type === 'RESPONSE') {
      const pending = this.pending.get(msg.requestId);
      if (!pending) return;
      this.pending.delete(msg.requestId);
      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else {
        pending.resolve(msg.data);
      }
    }

    if (msg.type === 'EVENT') {
      const handlers = this.listeners.get(msg.event) ?? [];
      handlers.forEach((h) => h(msg.data));
    }
  }

  /** Send a message to the runtime and await the response */
  send<T = unknown>(
    partial: { type: AgentToRuntimeMessage['type'] } & Record<string, unknown>,
  ): Promise<T> {
    const id = randomUUID();
    const message: AgentToRuntimeMessage = {
      __magically: true,
      id,
      direction: 'agent→runtime',
      ...(partial as any),
    };

    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (d: unknown) => void,
        reject,
      });

      if (typeof window !== 'undefined') {
        window.parent.postMessage(message, '*');
      } else {
        reject(new Error('BridgeClient requires a browser context'));
      }
    });
  }

  /** Subscribe to runtime-push events (e.g. data refreshes) */
  on(event: string, handler: (data: unknown) => void) {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, handler]);
    return () => {
      const updated = (this.listeners.get(event) ?? []).filter((h) => h !== handler);
      this.listeners.set(event, updated);
    };
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handleIncoming.bind(this));
    }
    this.pending.clear();
    this.listeners.clear();
  }
}

// ─── Host-side bridge (runs in the main React app, hosts iframes) ──────────

/**
 * BridgeHost — runs in the main app, not in the iframe.
 * Receives messages from agent iframes and dispatches them to the runtime API.
 */
export class BridgeHost {
  private handlers = new Map<
    string,
    (msg: AgentToRuntimeMessage, iframe: HTMLIFrameElement) => Promise<unknown>
  >();

  constructor(private readonly runtimeUrl: string) {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  private async handleMessage(event: MessageEvent) {
    const msg = event.data as AgentToRuntimeMessage;
    if (!msg?.__magically) return;
    if (msg.direction !== 'agent→runtime') return;

    const iframe = this.findIframeByWindow(event.source as Window);
    if (!iframe) return;

    const handler = this.handlers.get(msg.type);
    if (!handler) {
      this.respond(iframe, msg.id, undefined, `Unknown message type: ${msg.type}`);
      return;
    }

    try {
      const result = await handler(msg, iframe);
      this.respond(iframe, msg.id, result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.respond(iframe, msg.id, undefined, errorMsg);
    }
  }

  private respond(
    iframe: HTMLIFrameElement,
    requestId: string,
    data?: unknown,
    error?: string,
  ) {
    const response: RuntimeToAgentMessage = {
      __magically: true,
      id: randomUUID(),
      direction: 'runtime→agent',
      type: 'RESPONSE',
      requestId,
      data,
      error,
    };
    iframe.contentWindow?.postMessage(response, '*');
  }

  private findIframeByWindow(win: Window): HTMLIFrameElement | null {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      if (iframe.contentWindow === win) return iframe;
    }
    return null;
  }

  /** Register a handler for a specific message type */
  handle(
    type: AgentToRuntimeMessage['type'],
    handler: (msg: AgentToRuntimeMessage, iframe: HTMLIFrameElement) => Promise<unknown>,
  ) {
    this.handlers.set(type, handler);
  }

  /** Push an event to all agent iframes */
  broadcast(event: string, data: unknown) {
    const iframes = document.querySelectorAll('iframe[data-agent-id]');
    const message: RuntimeToAgentMessage = {
      __magically: true,
      id: randomUUID(),
      direction: 'runtime→agent',
      type: 'EVENT',
      event,
      data,
    };
    iframes.forEach((iframe) => {
      (iframe as HTMLIFrameElement).contentWindow?.postMessage(message, '*');
    });
  }

  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handleMessage.bind(this));
    }
  }
}
