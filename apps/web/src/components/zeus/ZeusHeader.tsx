import { memo } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  onClose: () => void;
  className?: string;
}

export const ZeusHeader = memo(function ZeusHeader({ onClose, className }: Props) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between border-b border-white/[0.07] px-5 py-4',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-base text-[#f97316]">◈</span>
        <span className="text-sm font-semibold text-[#f4f4f5]">Zeus</span>
      </div>
      <button
        onClick={onClose}
        aria-label="Close Zeus"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#71717a] transition-colors hover:bg-white/5 hover:text-[#a1a1aa]"
      >
        <X size={15} />
      </button>
    </div>
  );
});
