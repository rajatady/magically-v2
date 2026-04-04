import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { FileAttachment } from '@magically/shared/types';
import { useZeusSocket } from '@/hooks/use-zeus-socket';
import { ChatHeader } from './ChatHeader';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';

interface ChatViewProps {
  chatId: string | null;
  routePrefix: string;
  headerTitle: string;
  headerIcon: React.ReactNode;
  placeholder?: string;
  onClose?: () => void;
}

export const ChatView = memo(function ChatView({
  chatId,
  routePrefix,
  headerTitle,
  headerIcon,
  placeholder,
  onClose,
}: ChatViewProps) {
  const navigate = useNavigate();

  const {
    connected,
    reconnecting,
    streaming,
    messages,
    stream,
    sendMessage,
    interrupt,
  } = useZeusSocket({
    sessionId: chatId,
    onSessionCreated: (id) => {
      navigate(`${routePrefix}/${id}`, { replace: true });
    },
  });

  const handleSubmit = useCallback(
    (text: string, files?: FileAttachment[]) => {
      if (!text.trim() && (!files || files.length === 0)) return;
      sendMessage(text.trim(), files);
    },
    [sendMessage],
  );

  return (
    <div className="flex h-full flex-col">
      <ChatHeader title={headerTitle} icon={headerIcon} connected={connected} reconnecting={reconnecting} onClose={onClose} />
      <ChatMessages messages={messages} stream={stream} streaming={streaming} />
      <ChatInput
        onSubmit={handleSubmit}
        onStop={interrupt}
        streaming={streaming}
        disabled={!connected}
        placeholder={placeholder}
      />
    </div>
  );
});
