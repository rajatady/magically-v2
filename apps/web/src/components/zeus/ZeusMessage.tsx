import { memo } from 'react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import type { UIMessage } from 'ai';
import { cn } from '@/lib/cn';
import { extractTextFromMessage } from './ZeusMessages.logic';

interface Props {
  message: UIMessage;
  isActiveStream: boolean;
}

/**
 * Pure component — no hooks, no context.
 * Receives everything via props.
 */
const PureZeusMessage = function ZeusMessage({ message, isActiveStream }: Props) {
  const text = extractTextFromMessage(message);
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end px-4">
        <div
          className={cn(
            'max-w-[85%] rounded-[12px_12px_4px_12px]',
            'bg-[#f97316] px-3.5 py-2.5 text-sm leading-relaxed text-white',
            'whitespace-pre-wrap break-words',
          )}
        >
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start px-4">
      <div
        className={cn(
          'max-w-[85%] rounded-[12px_12px_12px_4px]',
          'bg-[#1c1c20] px-3.5 py-2.5 text-sm leading-relaxed text-[#f4f4f5]',
        )}
      >
        <Streamdown
          plugins={{ code }}
          isAnimating={isActiveStream}
          caret="block"
          mode={isActiveStream ? 'streaming' : 'static'}
        >
          {text}
        </Streamdown>
      </div>
    </div>
  );
};

export const ZeusMessage = memo(PureZeusMessage);
