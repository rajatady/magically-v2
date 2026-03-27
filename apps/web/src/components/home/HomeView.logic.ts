import type { AgentSummary } from '../../lib/api';

export function filterWidgetAgents(agents: AgentSummary[]): AgentSummary[] {
  return agents.filter((a) => a.hasWidget && a.enabled);
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
