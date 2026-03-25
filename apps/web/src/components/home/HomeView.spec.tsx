import { render, screen, fireEvent } from '@testing-library/react';
import { HomeView } from './HomeView.js';
import { useStore } from '../../lib/store.js';

const mockAgents = [
  { id: 'calendar-hero', name: 'Calendar Hero', icon: '📅', color: '#3b82f6', enabled: true, version: '1.0.0', hasWidget: true, functions: [] },
  { id: 'superdo', name: 'SuperDo', icon: '✅', enabled: true, version: '1.0.0', hasWidget: true, functions: [] },
  { id: 'no-widget', name: 'No Widget', icon: '◇', enabled: true, version: '1.0.0', hasWidget: false, functions: [] },
];

beforeEach(() => {
  useStore.setState({ agents: [], view: 'home', zeusOpen: false });
});

describe('HomeView', () => {
  it('shows empty state when no agents have widgets', () => {
    render(<HomeView />);
    expect(screen.getByText(/Your home screen is empty/i)).toBeInTheDocument();
  });

  it('shows widget cards for agents that have widgets', () => {
    useStore.setState({ agents: mockAgents });
    render(<HomeView />);

    expect(screen.getByTestId('widget-calendar-hero')).toBeInTheDocument();
    expect(screen.getByTestId('widget-superdo')).toBeInTheDocument();
    // no-widget agent should NOT appear
    expect(screen.queryByTestId('widget-no-widget')).not.toBeInTheDocument();
  });

  it('clicking a widget navigates to agent view', () => {
    useStore.setState({ agents: mockAgents });
    render(<HomeView />);

    fireEvent.click(screen.getByTestId('widget-calendar-hero'));
    expect(useStore.getState().view).toBe('agent');
    expect(useStore.getState().activeAgentId).toBe('calendar-hero');
  });

  it('does not show disabled agents in home grid', () => {
    useStore.setState({
      agents: [{ ...mockAgents[0], enabled: false }],
    });
    render(<HomeView />);
    expect(screen.queryByTestId('widget-calendar-hero')).not.toBeInTheDocument();
  });

  it('empty state button opens zeus', () => {
    render(<HomeView />);
    fireEvent.click(screen.getByText('Ask Zeus'));
    expect(useStore.getState().zeusOpen).toBe(true);
  });
});
