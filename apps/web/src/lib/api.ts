import { ApiClient } from '@magically/shared/api-client';
import { useAuthStore } from './auth';

export type {
  AgentSummary,
  FeedItem,
  AppConfig,
  MemoryEntry,
  ZeusTask,
  RunResult,
  AuthResult,
} from '@magically/shared/types';

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
