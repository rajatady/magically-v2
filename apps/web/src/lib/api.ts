import { ApiClient } from '@magically/shared';
import { useAuthStore } from './auth';

export type {
  AgentSummary,
  FeedItem,
  AppConfig,
  MemoryEntry,
  ZeusTask,
  RunResult,
  AuthResult,
} from '@magically/shared';

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4321';

export const api = new ApiClient({
  baseUrl: BASE_URL,
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => {
    useAuthStore.getState().logout();
    window.location.href = '/login';
  },
});

// Re-export for convenience
export const { auth, agents, feed, zeus, config } = api;

// Streaming needs direct access to fetch with auth — keep it here
export async function* streamZeusChat(
  message: string,
  conversationId?: string,
): AsyncGenerator<{ content?: string; done?: boolean; conversationId?: string; error?: string }> {
  const token = useAuthStore.getState().token;
  const res = await fetch(`${BASE_URL}/api/zeus/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, conversationId }),
  });

  if (res.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

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
