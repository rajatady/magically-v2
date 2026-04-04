import { memo } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

interface ChatHeaderProps {
  title: string;
  icon: React.ReactNode;
  connected: boolean;
  reconnecting?: boolean;
  onClose?: () => void;
}

export const ChatHeader = memo(function ChatHeader({ title, icon, connected, reconnecting, onClose }: ChatHeaderProps) {
  const state: ConnectionState = reconnecting ? 'reconnecting' : connected ? 'connected' : 'disconnected';

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="text-accent">{icon}</span>
        <span className="text-sm font-semibold text-text-1">{title}</span>
        <span className={cn(
          'size-2 rounded-full',
          state === 'connected' && 'bg-green-500',
          state === 'disconnected' && 'bg-red-500',
          state === 'reconnecting' && 'animate-pulse bg-yellow-500',
        )} />
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-bg-hover hover:text-text-2"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
});
