import { useStore } from '../../lib/store';
import { feed as feedApi } from '../../lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getFeedItemColor, getFeedItemIconName } from './FeedView.logic';
import { Info, CheckCircle, AlertTriangle, XCircle, Music, X } from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  'info':           Info,
  'check-circle':   CheckCircle,
  'alert-triangle': AlertTriangle,
  'x-circle':       XCircle,
  'music':          Music,
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
    <div data-testid="feed-view" className="flex-1 overflow-y-auto bg-bg-shell p-6">
      <h1 className="mb-5 font-serif text-2xl font-normal italic text-text-1">
        Feed
      </h1>

      {feed.length === 0 ? (
        <div className="pt-16 text-center text-text-3">
          No activity yet. Agents will post here when they do things for you.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
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
  const color = getFeedItemColor(item.type);
  const iconName = getFeedItemIconName(item.type);
  const IconComponent = ICON_MAP[iconName] ?? Info;

  return (
    <div
      data-testid={`feed-item-${item.id}`}
      onClick={!item.read ? onRead : undefined}
      className={cn(
        'flex gap-3 rounded-lg border px-4 py-3 transition-opacity',
        item.read
          ? 'cursor-default border-border bg-bg-panel opacity-60'
          : 'cursor-pointer border-accent-dim bg-bg-card',
      )}
    >
      <span className="shrink-0 pt-px" style={{ color }}>
        <IconComponent size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <div className={cn('font-medium', item.body && 'mb-1')}>
          {item.title}
        </div>
        {item.body && (
          <div className="text-[13px] text-text-2">{item.body}</div>
        )}
        {item.audioUrl && (
          <audio controls src={item.audioUrl} className="mt-2 h-8 w-full" />
        )}
      </div>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        title="Dismiss"
        className="shrink-0 text-text-3"
      >
        <X size={14} />
      </Button>
    </div>
  );
}
