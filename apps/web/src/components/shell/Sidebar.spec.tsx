// Skip under bun test — needs jsdom + React (run via `vitest run` in web package)
const hasDom = typeof globalThis.document !== 'undefined';
const maybeDescribe = hasDom ? describe : describe.skip;

import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar.js';
import { useStore } from '../../lib/store.js';

beforeEach(() => {
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

maybeDescribe('Sidebar', () => {
  it('renders the logo', () => {
    render(<Sidebar />);
    expect(screen.getByText('✨')).toBeInTheDocument();
  });

  it('renders all nav items', () => {
    render(<Sidebar />);
    expect(screen.getByTitle('Home')).toBeInTheDocument();
    expect(screen.getByTitle('Feed')).toBeInTheDocument();
    expect(screen.getByTitle('Gallery')).toBeInTheDocument();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('clicking Home nav sets view to home', () => {
    useStore.getState().setView('feed');
    render(<Sidebar />);
    fireEvent.click(screen.getByTitle('Home'));
    expect(useStore.getState().view).toBe('home');
  });

  it('clicking Zeus button toggles zeus panel', () => {
    render(<Sidebar />);
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

    render(<Sidebar />);
    expect(screen.getByTitle('Calendar Hero')).toBeInTheDocument();
    expect(screen.getByTitle('SuperDo')).toBeInTheDocument();
  });

  it('clicking an agent sets view to agent with the correct id', () => {
    useStore.setState({
      agents: [
        { id: 'calendar-hero', name: 'Calendar Hero', icon: '📅', enabled: true, version: '1.0.0', hasWidget: true, functions: [] },
      ],
    });

    render(<Sidebar />);
    fireEvent.click(screen.getByTitle('Calendar Hero'));

    expect(useStore.getState().view).toBe('agent');
    expect(useStore.getState().activeAgentId).toBe('calendar-hero');
  });
});
