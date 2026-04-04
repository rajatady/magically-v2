import { describe, expect, it, vi, beforeEach } from 'vitest';

// Skip under bun test — needs jsdom + React (run via `vitest run` in web package)
const hasDom = typeof globalThis.document !== 'undefined';
const maybeDescribe = hasDom ? describe : describe.skip;

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomeView } from './HomeView.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockWidgetsList = vi.fn();
vi.mock('../../lib/api.js', () => ({
  widgets: { list: (...args: unknown[]) => mockWidgetsList(...args) },
}));

beforeEach(() => {
  mockNavigate.mockClear();
  mockWidgetsList.mockReset();
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

maybeDescribe('HomeView', () => {
  it('shows empty state when no widgets exist', async () => {
    mockWidgetsList.mockResolvedValue([]);
    renderWithRouter(<HomeView />);

    await waitFor(() => {
      expect(screen.getByText(/Your home screen is empty/i)).toBeInTheDocument();
    });
  });

  it('renders widget HTML from API', async () => {
    mockWidgetsList.mockResolvedValue([
      {
        id: 'w1',
        userId: 'u1',
        agentId: 'hello-world',
        size: 'small',
        html: '<div data-testid="widget-hello">Hello!</div>',
        position: 0,
        updatedAt: '2026-04-03T00:00:00Z',
      },
    ]);

    renderWithRouter(<HomeView />);

    await waitFor(() => {
      expect(screen.getByTestId('widget-hello')).toBeInTheDocument();
    });
  });

  it('shows loading skeleton before widgets load', () => {
    mockWidgetsList.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithRouter(<HomeView />);

    expect(screen.getByTestId('home-view')).toBeInTheDocument();
  });

  it('empty state button navigates to /zeus', async () => {
    mockWidgetsList.mockResolvedValue([]);
    renderWithRouter(<HomeView />);

    await waitFor(() => {
      expect(screen.getByText('Ask Zeus')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Ask Zeus'));
    expect(mockNavigate).toHaveBeenCalledWith('/zeus');
  });
});
