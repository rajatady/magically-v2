import { memo } from 'react';
import { X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onClose: () => void;
  connected?: boolean;
  sessionId?: string | null;
}

export const ZeusHeader = memo(function ZeusHeader({ onClose, connected, sessionId }: Props) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-accent" />
        <span className="text-sm font-semibold text-text-1">Zeus</span>
        <span className={cn(
          'size-2 rounded-full',
          connected ? 'bg-green-500' : 'bg-red-500',
        )} />
      </div>
      <button
        onClick={onClose}
        aria-label="Close Zeus"
        className="flex size-7 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-bg-hover hover:text-text-2"
      >
        <X size={15} />
      </button>
    </div>
  );
});
