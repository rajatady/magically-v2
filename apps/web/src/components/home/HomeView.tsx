import { useStore } from '../../lib/store.js';
import { WIDGET_GRID_SPANS } from '@magically/widget-dsl';

export function HomeView() {
  const { agents, setView } = useStore();
  const widgetAgents = agents.filter((a) => a.hasWidget && a.enabled);

  return (
    <div
      data-testid="home-view"
      style={{
        flex: 1,
        padding: 24,
        overflowY: 'auto',
        background: 'var(--bg-shell)',
      }}
    >
      <h1 style={{
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
        fontSize: 28,
        fontWeight: 400,
        color: 'var(--text-1)',
        marginBottom: 24,
      }}>
        Good morning ✨
      </h1>

      {widgetAgents.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          alignItems: 'start',
        }}>
          {widgetAgents.map((agent) => (
            <WidgetCard
              key={agent.id}
              agent={agent}
              onClick={() => setView('agent', agent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetCard({
  agent,
  onClick,
}: {
  agent: { id: string; name: string; icon?: string; color?: string };
  onClick: () => void;
}) {
  return (
    <div
      data-testid={`widget-${agent.id}`}
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        padding: 16,
        cursor: 'pointer',
        transition: 'transform 0.15s, box-shadow 0.15s',
        minHeight: 120,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = '';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{agent.icon ?? '◇'}</span>
        <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
          {agent.name}
        </span>
      </div>
      <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
        Click to open
      </div>
    </div>
  );
}

function EmptyState() {
  const { toggleZeus } = useStore();
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
      gap: 16,
      color: 'var(--text-3)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 48 }}>✨</div>
      <h2 style={{ fontSize: 20, color: 'var(--text-2)', fontWeight: 500 }}>
        Your home screen is empty
      </h2>
      <p style={{ fontSize: 14, maxWidth: 320 }}>
        Ask Zeus to build your first agent, or browse the Gallery to find one.
      </p>
      <button
        onClick={toggleZeus}
        style={{
          background: 'var(--accent)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: 'var(--radius-md)',
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        Ask Zeus
      </button>
    </div>
  );
}
