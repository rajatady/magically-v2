import { useCallback, useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { ZeusDataPart } from '@/lib/zeus-types';
import { useAuthStore } from '@/lib/auth';
import { DataStreamProvider, useDataStream } from './DataStreamProvider';
import { DataStreamHandler } from './DataStreamHandler';
import { ZeusHeader } from './ZeusHeader';
import { ZeusMessages } from './ZeusMessages';
import { ZeusInput } from './ZeusInput';

interface Props {
  onClose: () => void;
}

/**
 * Inner component — has access to DataStreamContext.
 * Owns all chat state and wiring.
 */
function ZeusChatInner({ onClose }: Props) {
  const { setDataStream } = useDataStream();
  const [input, setInput] = useState('');

  // Stable transport — reads fresh token from store at request time
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/zeus/chat',
        headers: (): Record<string, string> => {
          const token = useAuthStore.getState().token;
          if (!token) return {};
          return { Authorization: `Bearer ${token}` };
        },
      }),
    [],
  );

  const { messages, sendMessage, stop, status, error } = useChat({
    transport,
    onData: (dataPart) => {
      setDataStream((prev) => [...prev, dataPart as ZeusDataPart]);
    },
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    sendMessage({ text });
    setInput('');
  }, [input, isStreaming, sendMessage]);

  const handleInputChange = useCallback((value: string) => setInput(value), []);

  return (
    <div className="flex h-full flex-col">
      <ZeusHeader onClose={onClose} />

      <ZeusMessages
        messages={messages}
        status={status}
        error={error ?? null}
        className="flex-1"
      />

      <DataStreamHandler />

      <ZeusInput
        input={input}
        disabled={false}
        isStreaming={isStreaming}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        onStop={stop}
      />
    </div>
  );
}

/**
 * Wraps ZeusChatInner with DataStreamProvider so the handler can consume context.
 */
export function ZeusChat({ onClose }: Props) {
  return (
    <DataStreamProvider>
      <ZeusChatInner onClose={onClose} />
    </DataStreamProvider>
  );
}
