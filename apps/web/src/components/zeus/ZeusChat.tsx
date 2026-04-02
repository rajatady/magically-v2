import { memo } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatView } from '@/components/chat/ChatView';

interface Props {
  onClose: () => void;
}

function extractChatId(pathname: string): string | null {
  const match = pathname.match(/^\/zeus\/(.+)$/);
  return match ? match[1] : null;
}

export const ZeusChat = memo(function ZeusChat({ onClose }: Props) {
  const location = useLocation();
  const chatId = extractChatId(location.pathname);

  return (
    <ChatView
      chatId={chatId}
      routePrefix="/zeus"
      headerTitle="Zeus"
      headerIcon="◈"
      placeholder="Ask Zeus anything…"
      onClose={onClose}
    />
  );
});
