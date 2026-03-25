import { useStore } from '../../lib/store';
import { useAuthStore } from '../../lib/auth';
import { BASE_URL_URL } from '../../lib/api';

export function AgentView() {
  const { activeAgentId, agents } = useStore();
  const token = useAuthStore((s) => s.token);
  const agent = agents.find((a) => a.id === activeAgentId);

  if (!agent) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-3)',
      }}>
        Agent not found
      </div>
    );
  }

  // Check if agent has a UI entry
  const hasUi = agent.functions.length > 0 || (agent as any).ui;

  if (!hasUi) {
    return (
      <div
        data-testid="agent-view"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <AgentHeader agent={agent} />
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, color: 'var(--text-3, #6b6b76)',
        }}>
          <span style={{ fontSize: 48 }}>{agent.icon ?? '◇'}</span>
          <span style={{ fontSize: 16, fontWeight: 500 }}>{agent.name}</span>
          <span style={{ fontSize: 13 }}>{agent.description ?? 'No UI configured for this agent'}</span>
        </div>
      </div>
    );
  }

  const src = `${BASE_URL}/agents/${agent.id}/ui?token=${encodeURIComponent(token ?? '')}`;

  return (
    <div
      data-testid="agent-view"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <AgentHeader agent={agent} />

      <iframe
        data-testid={`agent-iframe-${agent.id}`}
        src={src}
        data-agent-id={agent.id}
        title={agent.name}
        sandbox="allow-scripts allow-forms allow-same-origin"
        style={{
          flex: 1,
          border: 'none',
          background: 'var(--bg-shell)',
          width: '100%',
        }}
      />
    </div>
  );
}

function AgentHeader({ agent }: { agent: { icon?: string; name: string; color?: string } }) {
  return (
    <div style={{
      height: 48,
      borderBottom: '1px solid var(--border, #2a2a2f)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 10,
      background: 'var(--bg-panel)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 18 }}>{agent.icon ?? '◇'}</span>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{agent.name}</span>
      {agent.color && (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: agent.color, flexShrink: 0,
        }} />
      )}
    </div>
  );
}
