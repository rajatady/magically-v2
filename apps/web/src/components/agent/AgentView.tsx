import { useStore } from '../../lib/store.js';

const RUNTIME_URL = 'http://localhost:4321/api';

export function AgentView() {
  const { activeAgentId, agents } = useStore();
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

  const src = `${RUNTIME_URL}/agents/${agent.id}/ui`;

  return (
    <div
      data-testid="agent-view"
      style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Agent header bar */}
      <div style={{
        height: 48,
        borderBottom: '1px solid var(--border)',
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

      {/* Agent UI in sandboxed iframe */}
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
