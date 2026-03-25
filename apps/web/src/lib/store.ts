import { create } from 'zustand';
import type { AgentSummary, FeedItem, AppConfig } from './api.js';

export type View = 'home' | 'feed' | 'zeus' | 'agent' | 'build' | 'gallery' | 'settings';

interface AppState {
  // Navigation
  view: View;
  activeAgentId: string | null;
  zeusOpen: boolean;

  // Data
  agents: AgentSummary[];
  feed: FeedItem[];
  config: AppConfig | null;

  // Zeus conversation
  conversationId: string | null;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  zeusTyping: boolean;

  // Actions
  setView: (view: View, agentId?: string) => void;
  toggleZeus: () => void;
  setAgents: (agents: AgentSummary[]) => void;
  setFeed: (items: FeedItem[]) => void;
  prependFeedItem: (item: FeedItem) => void;
  setConfig: (config: AppConfig) => void;
  setConversationId: (id: string) => void;
  addMessage: (msg: { role: 'user' | 'assistant'; content: string }) => void;
  appendToLastMessage: (content: string) => void;
  setZeusTyping: (typing: boolean) => void;
  markFeedRead: (id: string) => void;
  dismissFeedItem: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  view: 'home',
  activeAgentId: null,
  zeusOpen: false,

  agents: [],
  feed: [],
  config: null,

  conversationId: null,
  messages: [],
  zeusTyping: false,

  setView: (view, agentId) =>
    set({ view, activeAgentId: agentId ?? null }),

  toggleZeus: () =>
    set((s) => ({ zeusOpen: !s.zeusOpen })),

  setAgents: (agents) => set({ agents }),
  setFeed: (feed) => set({ feed }),

  prependFeedItem: (item) =>
    set((s) => ({ feed: [item, ...s.feed] })),

  setConfig: (config) => set({ config }),

  setConversationId: (id) => set({ conversationId: id }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendToLastMessage: (content) =>
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        messages[messages.length - 1] = { ...last, content: last.content + content };
      } else {
        messages.push({ role: 'assistant', content });
      }
      return { messages };
    }),

  setZeusTyping: (typing) => set({ zeusTyping: typing }),

  markFeedRead: (id) =>
    set((s) => ({
      feed: s.feed.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    })),

  dismissFeedItem: (id) =>
    set((s) => ({ feed: s.feed.filter((item) => item.id !== id) })),
}));
