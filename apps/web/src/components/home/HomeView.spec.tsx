import { describe, expect, it, vi, beforeEach } from 'vitest';

// Skip under bun test — needs jsdom + React (run via `vitest run` in web package)
const hasDom = typeof globalThis.document !== 'undefined';
const maybeDescribe = hasDom ? describe : describe.skip;

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomeView } from './HomeView.js';
import { useStore } from '../../lib/store.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAgents = [
  { id: 'calendar-hero', name: 'Calendar Hero', icon: '📅', color: '#3b82f6', enabled: true, version: '1.0.0', hasWidget: true, functions: [] },
  { id: 'superdo', name: 'SuperDo', icon: '✅', enabled: true, version: '1.0.0', hasWidget: true, functions: [] },
  { id: 'no-widget', name: 'No Widget', icon: '◇', enabled: true, version: '1.0.0', hasWidget: false, functions: [] },
];

beforeEach(() => {
  mockNavigate.mockClear();
  useStore.setState({ agents: [], view: 'home', zeusOpen: false });
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

maybeDescribe('HomeView', () => {
  it('shows empty state when no agents have widgets', () => {
    renderWithRouter(<HomeView />);
    expect(screen.getByText(/Your home screen is empty/i)).toBeInTheDocument();
  });

  it('shows widget cards for agents that have widgets', () => {
    useStore.setState({ agents: mockAgents });
    renderWithRouter(<HomeView />);

    expect(screen.getByTestId('widget-calendar-hero')).toBeInTheDocument();
    expect(screen.getByTestId('widget-superdo')).toBeInTheDocument();
    // no-widget agent should NOT appear
    expect(screen.queryByTestId('widget-no-widget')).not.toBeInTheDocument();
  });

  it('clicking a widget navigates to /agents/:agentId', () => {
    useStore.setState({ agents: mockAgents });
    renderWithRouter(<HomeView />);

    fireEvent.click(screen.getByTestId('widget-calendar-hero'));
    expect(mockNavigate).toHaveBeenCalledWith('/agents/calendar-hero');
  });

  it('does not show disabled agents in home grid', () => {
    useStore.setState({
      agents: [{ ...mockAgents[0], enabled: false }],
    });
    renderWithRouter(<HomeView />);
    expect(screen.queryByTestId('widget-calendar-hero')).not.toBeInTheDocument();
  });

  it('empty state button navigates to /zeus', () => {
    renderWithRouter(<HomeView />);
    fireEvent.click(screen.getByText('Ask Zeus'));
    expect(mockNavigate).toHaveBeenCalledWith('/zeus');
  });
});
