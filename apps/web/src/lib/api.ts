const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4321') + '/api';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${opts?.method ?? 'GET'} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export interface AgentSummary {
  id: string;
  name: string;
  version: string;
  description?: string;
  icon?: string;
  color?: string;
  enabled: boolean;
  hasWidget: boolean;
  functions: Array<{ name: string; description: string }>;
}

export const agents = {
  list: () => req<AgentSummary[]>('/agents'),
  get: (id: string) => req<AgentSummary>(`/agents/${id}`),
  widget: (id: string) => req<unknown>(`/agents/${id}/widget`),
  action: (id: string, action: string, payload?: unknown) =>
    req(`/agents/${id}/action`, { method: 'POST', body: JSON.stringify({ action, payload }) }),
  enable: (id: string) => req(`/agents/${id}/enable`, { method: 'PUT' }),
  disable: (id: string) => req(`/agents/${id}/disable`, { method: 'PUT' }),
};

// ─── Feed ─────────────────────────────────────────────────────────────────────

export interface FeedItem {
  id: string;
  agentId?: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'audio';
  title: string;
  body?: string;
  data?: unknown;
  audioUrl?: string;
  read: boolean;
  createdAt: string;
}

export const feed = {
  list: (limit?: number) => req<FeedItem[]>(`/feed${limit ? `?limit=${limit}` : ''}`),
  markRead: (id: string) => req(`/feed/${id}/read`, { method: 'POST' }),
  dismiss: (id: string) => req(`/feed/${id}/dismiss`, { method: 'POST' }),
};

// ─── Zeus ─────────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  key: string;
  value: string;
  category: string;
  source: string;
}

export interface ZeusTask {
  id: string;
  requesterId: string;
  goal: string;
  status: string;
  priority: string;
  createdAt: string;
}

export const zeus = {
  createConversation: (mode?: string) =>
    req<{ id: string; mode: string; messages: unknown[] }>('/zeus/conversations', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),
  memory: () => req<MemoryEntry[]>('/zeus/memory'),
  tasks: () => req<ZeusTask[]>('/zeus/tasks'),
};

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AppConfig {
  hasApiKey: boolean;
  defaultModel?: string;
  zeusName?: string;
  theme?: string;
  accentColor?: string;
}

export const config = {
  get: () => req<AppConfig>('/config'),
  update: (partial: Partial<AppConfig & { openrouterApiKey?: string }>) =>
    req<AppConfig>('/config', { method: 'PUT', body: JSON.stringify(partial) }),
};

// ─── Zeus streaming chat ─────────────────────────────────────────────────────

export async function* streamZeusChat(
  message: string,
  conversationId?: string,
): AsyncGenerator<{ content?: string; done?: boolean; conversationId?: string; error?: string }> {
  const res = await fetch(`${BASE}/zeus/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
