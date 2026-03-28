/**
 * WebSocket hook for Zeus chat — connects to Socket.IO /zeus namespace.
 * Ported from cc-harness useWebSocket, adapted for Magically.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../lib/auth';
import { zeus } from '../lib/api';
import {
  createEmptyStreamState,
  applyChunk,
  applyToolStart,
  applyToolResult,
  extractPlainText,
  type StreamState,
  type ZeusMessage,
} from '../lib/zeus-blocks';

export interface UseZeusSocketOptions {
  sessionId: string | null;
  onSessionCreated?: (sessionId: string) => void;
}

export interface UseZeusSocketReturn {
  connected: boolean;
  streaming: boolean;
  messages: ZeusMessage[];
  stream: StreamState | null;
  sendMessage: (text: string) => void;
  interrupt: () => void;
  setMessages: React.Dispatch<React.SetStateAction<ZeusMessage[]>>;
}

export function useZeusSocket({ sessionId, onSessionCreated }: UseZeusSocketOptions): UseZeusSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef<StreamState>(createEmptyStreamState());
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [stream, setStream] = useState<StreamState | null>(null);
  const [messages, setMessages] = useState<ZeusMessage[]>([]);

  const notify = useCallback(() => {
    setStream({
      ...stateRef.current,
      blocks: [...stateRef.current.blocks],
    });
  }, []);

  // Load past messages when sessionId is provided (e.g., navigating to /zeus/:chatId)
  useEffect(() => {
    if (!sessionId) return;

    zeus.getConversation(sessionId)
      .then((conv) => {
        if (!conv?.messages || !Array.isArray(conv.messages)) return;
        const loaded: ZeusMessage[] = conv.messages.map((m: { id?: string; role: string; content: string; blocks?: string | unknown[]; createdAt?: string }) => ({
          id: m.id ?? crypto.randomUUID(),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          // blocks may be a JSON string (from zeus_messages table) or already parsed
          blocks: typeof m.blocks === 'string' ? JSON.parse(m.blocks) : m.blocks as ZeusMessage['blocks'],
          createdAt: m.createdAt ?? new Date().toISOString(),
        }));
        setMessages(loaded);
      })
      .catch(() => {});
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    const socket = io('/zeus', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('session', (msg: { sessionId: string }) => {
      onSessionCreated?.(msg.sessionId);
    });

    socket.on('chunk', (msg: { text: string }) => {
      applyChunk(stateRef.current, msg.text);
      notify();
    });

    socket.on('tool:start', (msg: { id: string; tool: string; input: Record<string, unknown> }) => {
      applyToolStart(stateRef.current, msg.id, msg.tool, msg.input ?? {});
      notify();
    });

    socket.on('tool:result', (msg: { id: string; result: string }) => {
      applyToolResult(stateRef.current, msg.id, msg.result);
      notify();
    });

    socket.on('status', (msg: { status: string }) => {
      stateRef.current.status = msg.status;
      notify();
    });

    socket.on('result', (msg: { cost: number; turns: number; durationMs: number; usage: unknown }) => {
      stateRef.current.result = msg;
      stateRef.current.status = null;
      notify();
    });

    socket.on('done', () => {
      const finalState = stateRef.current;
      const plainText = extractPlainText(finalState.blocks);

      if (plainText || finalState.blocks.length > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: plainText,
            blocks: [...finalState.blocks],
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      setStream(null);
      setStreaming(false);
    });

    socket.on('error', (msg: { message: string }) => {
      stateRef.current.error = msg.message;
      notify();
      setStreaming(false);
    });

    socket.on('interrupted', () => {
      setStreaming(false);
      setStream(null);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    (text: string) => {
      // Add optimistic user message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Reset stream state
      stateRef.current = createEmptyStreamState();
      setStream(null);
      setStreaming(true);

      socketRef.current?.emit('prompt', { prompt: text, sessionId });
    },
    [sessionId],
  );

  const interrupt = useCallback(() => {
    socketRef.current?.emit('interrupt');
  }, []);

  return { connected, streaming, messages, stream, sendMessage, interrupt, setMessages };
}
