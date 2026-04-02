import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChatList } from './ChatList';

vi.mock('@/lib/api', () => ({
  zeus: {
    listConversations: vi.fn().mockResolvedValue([
      { id: 'conv-1', title: 'First chat', mode: 'chat', createdAt: '2026-04-01T10:00:00Z', updatedAt: '2026-04-01T11:00:00Z' },
      { id: 'conv-2', title: null, mode: 'build', createdAt: '2026-04-01T09:00:00Z', updatedAt: '2026-04-01T10:30:00Z' },
      { id: 'conv-3', title: 'Third chat', mode: 'chat', createdAt: '2026-04-01T08:00:00Z', updatedAt: '2026-04-01T09:00:00Z' },
    ]),
    deleteConversation: vi.fn().mockResolvedValue(undefined),
  },
}));

function renderWithRouter(activeChatId?: string) {
  const path = activeChatId ? `/chat/${activeChatId}` : '/chats';
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ChatList activeChatId={activeChatId ?? null} />
    </MemoryRouter>,
  );
}

describe('ChatList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conversation list after loading', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('First chat')).toBeDefined();
    });
    expect(screen.getByText('Third chat')).toBeDefined();
  });

  it('shows untitled label for conversations without title', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByText('Untitled')).toBeDefined();
    });
  });

  it('highlights active conversation', async () => {
    renderWithRouter('conv-1');
    await waitFor(() => {
      expect(screen.getByText('First chat')).toBeDefined();
    });
    const activeItem = screen.getByText('First chat').closest('[data-active]');
    expect(activeItem?.getAttribute('data-active')).toBe('true');
  });

  it('renders new chat button', async () => {
    renderWithRouter();
    await waitFor(() => {
      expect(screen.getByLabelText('New chat')).toBeDefined();
    });
  });

  it('shows loading skeleton initially', () => {
    renderWithRouter();
    expect(screen.getByTestId('chat-list-loading')).toBeDefined();
  });
});
