import { useStore } from '../../lib/store.js';
import { feed as feedApi } from '../../lib/api.js';

const TYPE_COLORS: Record<string, string> = {
  info:    'var(--text-3)',
  success: '#22c55e',
  warning: '#f59e0b',
  error:   '#ef4444',
  audio:   'var(--accent)',
};

const TYPE_ICONS: Record<string, string> = {
  info:    '◎',
  success: '✓',
  warning: '⚠',
  error:   '✕',
  audio:   '♪',
};

export function FeedView() {
  const { feed, markFeedRead, dismissFeedItem } = useStore();

  const handleRead = async (id: string) => {
    markFeedRead(id);
    feedApi.markRead(id).catch(console.error);
  };

  const handleDismiss = async (id: string) => {
    dismissFeedItem(id);
    feedApi.dismiss(id).catch(console.error);
  };

  return (
    <div
      data-testid="feed-view"
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
        fontSize: 24,
        fontWeight: 400,
        marginBottom: 20,
        color: 'var(--text-1)',
      }}>
        Feed
      </h1>

      {feed.length === 0 ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', paddingTop: 60 }}>
          No activity yet. Agents will post here when they do things for you.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {feed.map((item) => (
            <FeedItem
              key={item.id}
              item={item}
              onRead={() => handleRead(item.id)}
              onDismiss={() => handleDismiss(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedItem({
  item,
  onRead,
  onDismiss,
}: {
  item: { id: string; type: string; title: string; body?: string; read: boolean; audioUrl?: string };
  onRead: () => void;
  onDismiss: () => void;
}) {
  const color = TYPE_COLORS[item.type] ?? 'var(--text-3)';
  const icon = TYPE_ICONS[item.type] ?? '◎';

  return (
    <div
      data-testid={`feed-item-${item.id}`}
      onClick={!item.read ? onRead : undefined}
      style={{
        background: item.read ? 'var(--bg-panel)' : 'var(--bg-card)',
        border: `1px solid ${item.read ? 'var(--border)' : 'rgba(249,115,22,0.15)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        display: 'flex',
        gap: 12,
        cursor: item.read ? 'default' : 'pointer',
        opacity: item.read ? 0.6 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <span style={{ color, fontSize: 16, flexShrink: 0, paddingTop: 1 }}>{icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, marginBottom: item.body ? 4 : 0 }}>
          {item.title}
        </div>
        {item.body && (
          <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{item.body}</div>
        )}
        {item.audioUrl && (
          <audio
            controls
            src={item.audioUrl}
            style={{ marginTop: 8, width: '100%', height: 32 }}
          />
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        style={{ color: 'var(--text-3)', fontSize: 16, padding: '0 4px', flexShrink: 0 }}
        title="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
