import { memo } from 'react';
import { ZeusChat } from './ZeusChat';

interface Props {
  onClose: () => void;
}

export const ZeusPanel = memo(function ZeusPanel({ onClose }: Props) {
  return (
    <div
      data-testid="zeus-panel"
      className="flex h-full w-[400px] shrink-0 flex-col border-l border-border bg-bg-panel"
    >
      <ZeusChat onClose={onClose} />
    </div>
  );
});
