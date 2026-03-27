import type {
  AuthResult,
  ApiKeyResult,
  JwtPayload,
  AgentSummary,
  RunResult,
  FeedItem,
  AppConfig,
  MemoryEntry,
  ZeusTask,
} from './types';

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
}

export class ApiClient {
  constructor(private readonly options: ApiClientConfig) {}

  private get base() {
    return this.options.baseUrl + '/api';
  }

  private async req<T>(path: string, opts?: RequestInit): Promise<T> {
    const token = this.options.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers as Record<string, string> ?? {}),
    };

    const res = await fetch(`${this.base}${path}`, { ...opts, headers });

    if (res.status === 401) {
      this.options.onUnauthorized?.();
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${opts?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  auth = {
    signup: (email: string, password: string, name?: string) =>
      this.req<AuthResult>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),

    login: (email: string, password: string) =>
      this.req<AuthResult>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () => this.req<JwtPayload>('/auth/me'),

    createApiKey: (name: string) =>
      this.req<ApiKeyResult>('/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    googleUrl: () => `${this.base}/auth/google`,
  };

  // ─── Agents ────────────────────────────────────────────────────────────────

  agents = {
    list: () => this.req<AgentSummary[]>('/agents'),
    get: (id: string) => this.req<AgentSummary>(`/agents/${id}`),
    widget: (id: string) => this.req<unknown>(`/agents/${id}/widget`),
    enable: (id: string) => this.req(`/agents/${id}/enable`, { method: 'PUT' }),
    disable: (id: string) => this.req(`/agents/${id}/disable`, { method: 'PUT' }),
    run: (id: string, functionName: string, payload?: Record<string, unknown>) =>
      this.req<RunResult>(`/agents/${id}/run/${functionName}`, {
        method: 'POST',
        body: JSON.stringify(payload ?? {}),
      }),
  };

  // ─── Feed ──────────────────────────────────────────────────────────────────

  feed = {
    list: (limit = 50) => this.req<FeedItem[]>(`/feed?limit=${limit}`),
    markRead: (id: string) => this.req(`/feed/${id}/read`, { method: 'POST' }),
    dismiss: (id: string) => this.req(`/feed/${id}/dismiss`, { method: 'POST' }),
  };

  // ─── Zeus ──────────────────────────────────────────────────────────────────

  zeus = {
    createConversation: (mode?: string) =>
      this.req<{ id: string; mode: string }>('/zeus/conversations', {
        method: 'POST',
        body: JSON.stringify({ mode }),
      }),
    getConversation: (id: string) =>
      this.req<{ id: string; messages: Array<{ role: string; content: string; blocks?: unknown[] }>; mode: string; createdAt: string }>(`/zeus/conversations/${id}`),
    listConversations: () =>
      this.req<Array<{ id: string; title: string | null; mode: string; createdAt: string; updatedAt: string }>>('/zeus/conversations'),
    deleteConversation: (id: string) =>
      this.req<void>(`/zeus/conversations/${id}`, { method: 'DELETE' }),
    memory: () => this.req<MemoryEntry[]>('/zeus/memory'),
    tasks: () => this.req<ZeusTask[]>('/zeus/tasks'),
  };

  // ─── Config ────────────────────────────────────────────────────────────────

  config = {
    get: () => this.req<AppConfig>('/config'),
    update: (partial: Partial<AppConfig & { openrouterApiKey?: string }>) =>
      this.req<AppConfig>('/config', { method: 'PUT', body: JSON.stringify(partial) }),
  };

  // ─── Streaming (browser only) ─────────────────────────────────────────────

  async *streamZeusChat(
    message: string,
    conversationId?: string,
  ): AsyncGenerator<{ content?: string; done?: boolean; conversationId?: string; error?: string }> {
    const token = this.options.getToken();
    const res = await fetch(`${this.base}/zeus/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message, conversationId }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Zeus chat failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data) yield JSON.parse(data);
        }
      }
    }
  }
}
