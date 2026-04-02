import { useEffect } from 'react';
import { ChatList } from '@/components/chat/ChatList';

export function ChatsPage() {
  useEffect(() => {
    document.title = 'Chats — Magically';
  }, []);

  return (
    <div className="flex h-full">
      <div className="mx-auto w-full max-w-md">
        <ChatList activeChatId={null} />
      </div>
    </div>
  );
}
