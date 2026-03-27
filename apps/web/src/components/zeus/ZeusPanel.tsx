import { memo } from 'react';
import { useStore } from '@/lib/store';
import { ZeusChat } from './ZeusChat';

/**
 * Thin layout wrapper. Owns only:
 * - panel sizing + positioning
 * - open/close wiring with global store
 *
 * All chat logic lives in ZeusChat.
 */
export const ZeusPanel = memo(function ZeusPanel() {
  const { toggleZeus } = useStore();

  return (
    <div
      data-testid="zeus-panel"
      className="flex h-full w-[400px] shrink-0 flex-col border-l border-border bg-bg-panel"
    >
      <ZeusChat onClose={toggleZeus} />
    </div>
  );
});
