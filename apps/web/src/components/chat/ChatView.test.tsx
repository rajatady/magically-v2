import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatView } from './ChatView';

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

function renderWithRouter(chatId: string | null = null) {
  return render(
    <MemoryRouter initialEntries={[chatId ? `/chat/${chatId}` : '/chat/new']}>
      <ChatView
        chatId={chatId}
        routePrefix="/chat"
        headerTitle="Chat"
        headerIcon="💬"
        placeholder="Message…"
      />
    </MemoryRouter>,
  );
}

describe('ChatView', () => {
  it('renders header with provided title', () => {
    renderWithRouter();
    expect(screen.getByText('Chat')).toBeDefined();
  });

  it('renders message input with placeholder', () => {
    renderWithRouter();
    expect(screen.getByPlaceholderText('Message…')).toBeDefined();
  });

  it('renders message area', () => {
    renderWithRouter();
    expect(screen.getByRole('log')).toBeDefined();
  });

  it('shows connection status', () => {
    renderWithRouter();
    // ChatHeader shows green dot when connected
    const { container } = renderWithRouter();
    expect(container.querySelector('.bg-green-500')).not.toBeNull();
  });
});
