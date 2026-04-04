import { describe, expect, it, vi, beforeEach } from 'vitest';

// Skip under bun test — needs jsdom + React (run via `vitest run` in web package)
const hasDom = typeof globalThis.document !== 'undefined';
const maybeDescribe = hasDom ? describe : describe.skip;

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { useStore } from '../../lib/store.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  mockNavigate.mockClear();
  useStore.setState({
    view: 'home',
    activeAgentId: null,
    zeusOpen: false,
    agents: [],
    feed: [],
    config: null,
    conversationId: null,
    messages: [],
    zeusTyping: false,
  });
});

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/']) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

maybeDescribe('Sidebar', () => {
  it('renders the sidebar', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders all nav items', () => {
    renderWithRouter(<Sidebar />);
    expect(screen.getByTitle('Home')).toBeInTheDocument();
    expect(screen.getByTitle('Feed')).toBeInTheDocument();
    expect(screen.getByTitle('Gallery')).toBeInTheDocument();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('clicking Home nav navigates to /', () => {
    renderWithRouter(<Sidebar />);
    fireEvent.click(screen.getByTitle('Home'));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('clicking Feed nav navigates to /feed', () => {
    renderWithRouter(<Sidebar />);
    fireEvent.click(screen.getByTitle('Feed'));
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });

  it('clicking Gallery nav navigates to /gallery', () => {
    renderWithRouter(<Sidebar />);
    fireEvent.click(screen.getByTitle('Gallery'));
    expect(mockNavigate).toHaveBeenCalledWith('/gallery');
  });

  it('clicking Zeus button toggles zeus panel', () => {
    renderWithRouter(<Sidebar />);
    fireEvent.click(screen.getByTitle('Zeus'));
    expect(useStore.getState().zeusOpen).toBe(true);
  });

  it('renders agent buttons for installed agents', () => {
    useStore.setState({
      agents: [
        { id: 'calendar-hero', name: 'Calendar Hero', icon: '📅', enabled: true, version: '1.0.0', hasWidget: true, functions: [] },
        { id: 'superdo', name: 'SuperDo', icon: '✅', enabled: true, version: '1.0.0', hasWidget: true, functions: [] },
      ],
    });

    renderWithRouter(<Sidebar />);
    expect(screen.getByTitle('Calendar Hero')).toBeInTheDocument();
    expect(screen.getByTitle('SuperDo')).toBeInTheDocument();
  });

  it('clicking an agent navigates to /agents/:agentId', () => {
    useStore.setState({
      agents: [
        { id: 'calendar-hero', name: 'Calendar Hero', icon: '📅', enabled: true, version: '1.0.0', hasWidget: true, functions: [] },
      ],
    });

    renderWithRouter(<Sidebar />);
    fireEvent.click(screen.getByTitle('Calendar Hero'));

    expect(mockNavigate).toHaveBeenCalledWith('/agents/calendar-hero');
  });
});
