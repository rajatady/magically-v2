import { memo, useRef, useEffect, useCallback, useState } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onSubmit: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
}

export const ZeusInput = memo(function ZeusInput({ onSubmit, onStop, streaming, disabled }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;
    onSubmit(trimmed);
    setInput('');
  }, [input, streaming, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const canSubmit = input.trim().length > 0 && !streaming;

  return (
    <div className="shrink-0 border-t border-border px-3 py-3">
      <div className="flex items-end gap-2 rounded-xl bg-bg-card px-3 py-2.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled && !streaming}
          placeholder="Ask Zeus anything…"
          rows={1}
          aria-label="Message input"
          className={cn(
            'min-h-[20px] max-h-[120px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-text-1',
            'placeholder:text-text-3 focus:outline-none',
            'disabled:opacity-50',
          )}
        />
        {streaming ? (
          <button
            onClick={onStop}
            aria-label="Stop streaming"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent transition-colors hover:bg-accent/30"
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Send message"
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors',
              canSubmit
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'cursor-not-allowed bg-bg-hover text-text-3',
            )}
          >
            <ArrowUp size={14} />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-text-3">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
});
