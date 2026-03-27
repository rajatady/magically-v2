import { memo } from 'react';
import type { UIMessage } from 'ai';
import { cn } from '@/lib/cn';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';
import { ZeusMessage } from './ZeusMessage';
import { isActiveStream, isEmptyConversation, hasSentMessage } from './ZeusMessages.logic';

interface Props {
  messages: UIMessage[];
  status: string;
  error: Error | null;
  className?: string;
}

/** Thinking indicator — pure, no props needed beyond existence. */
const ThinkingMessage = memo(function ThinkingMessage() {
  return (
    <div className="flex justify-start px-4">
      <div className="rounded-[12px_12px_12px_4px] bg-[#1c1c20] px-3.5 py-2.5">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#71717a] [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#71717a] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#71717a] [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="text-2xl text-[#f97316]">◈</span>
      <p className="text-sm font-medium text-[#f4f4f5]">What can I help you build?</p>
      <p className="text-xs leading-relaxed text-[#71717a]">
        Route agents, build new ones, manage tasks, or just ask.
      </p>
    </div>
  );
});

/**
 * Pure component — receives messages, status, and error via props.
 * Owns scroll behavior internally via useScrollToBottom.
 */
const PureZeusMessages = function ZeusMessages({ messages, status, error, className }: Props) {
  const { containerRef, endRef } = useScrollToBottom();
  const showThinking = status === 'submitted' && messages[messages.length - 1]?.role === 'user';

  return (
    <div
      ref={containerRef}
      className={cn('flex flex-1 flex-col gap-3 overflow-y-auto py-4', className)}
    >
      {isEmptyConversation(messages) ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((message, index) => (
            <ZeusMessage
              key={message.id}
              message={message}
              isActiveStream={isActiveStream(message, status, index, messages.length)}
            />
          ))}

          {showThinking && <ThinkingMessage />}

          {error && (
            <div className="mx-4 rounded-lg bg-red-500/10 px-3.5 py-2.5 text-xs text-red-400">
              {error.message || 'Something went wrong. Please try again.'}
            </div>
          )}
        </>
      )}
      <div ref={endRef} className="shrink-0" />
    </div>
  );
};

export const ZeusMessages = memo(PureZeusMessages);
