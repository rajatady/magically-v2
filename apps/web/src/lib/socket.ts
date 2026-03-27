import { io, Socket } from 'socket.io-client';
import { useStore } from './store';
import type { FeedItem } from './api';

let socket: Socket | null = null;

export function connectSocket() {
  if (socket?.connected) return;

  socket = io('http://localhost:4321', {
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[socket] connected');
  });

  socket.on('disconnect', () => {
    console.log('[socket] disconnected');
  });

  socket.on('feed:new', ({ item }: { item: FeedItem }) => {
    useStore.getState().prependFeedItem(item);
  });

  socket.on('zeus:typing', ({ conversationId }: { conversationId: string }) => {
    const { conversationId: activeId, setZeusTyping } = useStore.getState();
    if (activeId === conversationId) setZeusTyping(true);
  });

  socket.on('zeus:chunk', ({ conversationId, content }: { conversationId: string; content: string }) => {
    const { conversationId: activeId, appendToLastMessage } = useStore.getState();
    if (activeId === conversationId) appendToLastMessage(content);
  });

  socket.on('zeus:done', ({ conversationId }: { conversationId: string }) => {
    const { conversationId: activeId, setZeusTyping } = useStore.getState();
    if (activeId === conversationId) setZeusTyping(false);
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
