import { memo, useCallback, useState } from 'react';
import { useZeusSocket } from '@/hooks/use-zeus-socket';
import { ZeusHeader } from './ZeusHeader';
import { ZeusMessages } from './ZeusMessages';
import { ZeusInput } from './ZeusInput';

interface Props {
  onClose: () => void;
}

export const ZeusChat = memo(function ZeusChat({ onClose }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);

  const {
    connected,
    streaming,
    messages,
    stream,
    sendMessage,
    interrupt,
  } = useZeusSocket({
    sessionId,
    onSessionCreated: (id) => setSessionId(id),
  });

  const handleSubmit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      sendMessage(text.trim());
    },
    [sendMessage],
  );

  return (
    <div className="flex h-full flex-col">
      <ZeusHeader onClose={onClose} connected={connected} sessionId={sessionId} />
      <ZeusMessages messages={messages} stream={stream} streaming={streaming} />
      <ZeusInput
        onSubmit={handleSubmit}
        onStop={interrupt}
        streaming={streaming}
        disabled={!connected}
      />
    </div>
  );
});
