import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ChatPage } from './ChatPage';
import { ChatsPage } from './ChatsPage';
import { NewChatPage } from './NewChatPage';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock('@/hooks/use-zeus-socket', () => ({
  useZeusSocket: vi.fn().mockReturnValue({
    connected: true,
    reconnecting: false,
    streaming: false,
    messages: [],
    stream: null,
    sendMessage: vi.fn(),
    interrupt: vi.fn(),
    setMessages: vi.fn(),
  }),
}));

vi.mock('@/lib/api', () => ({
  zeus: {
    listConversations: vi.fn().mockResolvedValue([]),
    getConversation: vi.fn().mockResolvedValue({ id: 'test-id', messages: [], mode: 'chat', createdAt: new Date().toISOString() }),
    createConversation: vi.fn().mockResolvedValue({ id: 'new-id', mode: 'chat' }),
    deleteConversation: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('ChatPage', () => {
  it('sets document title', () => {
    render(
      <MemoryRouter initialEntries={['/chat/test-id']}>
        <Routes>
          <Route path="/chat/:chatId" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.title).toBe('Chat — Magically');
  });
});

describe('ChatsPage', () => {
  it('sets document title to Chats', () => {
    render(
      <MemoryRouter initialEntries={['/chats']}>
        <Routes>
          <Route path="/chats" element={<ChatsPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.title).toBe('Chats — Magically');
  });
});

describe('NewChatPage', () => {
  it('sets document title to New Chat', () => {
    render(
      <MemoryRouter initialEntries={['/chat/new']}>
        <Routes>
          <Route path="/chat/new" element={<NewChatPage />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.title).toBe('New Chat — Magically');
  });
});
