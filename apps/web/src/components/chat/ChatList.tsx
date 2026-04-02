import { memo, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { zeus } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface Conversation {
  id: string;
  title: string | null;
  mode: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatListProps {
  activeChatId: string | null;
}

export const ChatList = memo(function ChatList({ activeChatId }: ChatListProps) {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    zeus.listConversations()
      .then((convs) => {
        setConversations(convs);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleNewChat = useCallback(() => {
    navigate('/chat/new');
  }, [navigate]);

  if (loading) {
    return (
      <div data-testid="chat-list-loading" className="flex flex-col gap-2 p-3">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text-1">Chats</h2>
        <button
          onClick={handleNewChat}
          aria-label="New chat"
          className="flex size-7 items-center justify-center rounded-md text-text-2 transition-colors hover:bg-bg-hover hover:text-text-1"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-text-3">
            No conversations yet
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 p-2">
            {conversations.map((conv) => (
              <ChatListItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeChatId}
                onClick={() => navigate(`/chat/${conv.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

interface ChatListItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

const ChatListItem = memo(function ChatListItem({ conversation, isActive, onClick }: ChatListItemProps) {
  const title = conversation.title ?? 'Untitled';
  const time = new Date(conversation.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <button
      onClick={onClick}
      data-active={isActive}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        isActive
          ? 'bg-accent/10 text-accent'
          : 'text-text-2 hover:bg-bg-hover hover:text-text-1',
      )}
    >
      <div className="flex-1 truncate">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="text-[11px] text-text-3">{time}</div>
      </div>
      {conversation.mode !== 'chat' && (
        <span className="shrink-0 rounded-full bg-bg-panel px-2 py-0.5 text-[10px] font-medium text-text-3">
          {conversation.mode}
        </span>
      )}
    </button>
  );
});
