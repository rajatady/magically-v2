import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { zeus } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

export function NewChatPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'New Chat — Magically';

    zeus.createConversation('chat')
      .then((conv) => {
        navigate(`/chat/${conv.id}`, { replace: true });
      })
      .catch(() => {
        navigate('/chats', { replace: true });
      });
  }, [navigate]);

  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="size-6 text-accent" />
    </div>
  );
}
