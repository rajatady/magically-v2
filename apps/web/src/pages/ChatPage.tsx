import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { ChatView } from '@/components/chat/ChatView';
import { ChatList } from '@/components/chat/ChatList';

export function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();

  useEffect(() => {
    document.title = 'Chat — Magically';
  }, []);

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:flex lg:flex-col">
        <ChatList activeChatId={chatId ?? null} />
      </aside>
      <div className="flex-1">
        <ChatView
          chatId={chatId ?? null}
          routePrefix="/chat"
          headerTitle="Chat"
          headerIcon={<MessageSquare size={16} />}
          placeholder="Message…"
        />
      </div>
    </div>
  );
}
