import { memo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useZeusSocket } from '@/hooks/use-zeus-socket';
import { ZeusHeader } from './ZeusHeader';
import { ZeusMessages } from './ZeusMessages';
import { ZeusInput } from './ZeusInput';

interface Props {
  onClose: () => void;
}

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/^\/zeus\/(.+)$/);
  return match ? match[1] : null;
}

export const ZeusChat = memo(function ZeusChat({ onClose }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const chatId = extractChatId(location.pathname);

  const {
    connected,
    streaming,
    messages,
    stream,
    sendMessage,
    interrupt,
  } = useZeusSocket({
    sessionId: chatId,
    onSessionCreated: (id) => {
      navigate(`/zeus/${id}`, { replace: true });
    },
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
      <ZeusHeader onClose={onClose} connected={connected} sessionId={chatId} />
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
