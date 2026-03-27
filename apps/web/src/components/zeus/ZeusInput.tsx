import { memo, useRef, useEffect, useCallback } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  input: string;
  disabled: boolean;
  isStreaming: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

/**
 * Pure component — no internal state, all controlled.
 * Auto-grows textarea up to max-height; collapses on clear.
 */
const PureZeusInput = function ZeusInput({ input, disabled, isStreaming, onChange, onSubmit, onStop }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit],
  );

  const canSubmit = input.trim().length > 0 && !isStreaming;

  return (
    <div className="shrink-0 border-t border-white/[0.07] px-3 py-3">
      <div className="flex items-end gap-2 rounded-xl bg-[#1c1c20] px-3 py-2.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled && !isStreaming}
          placeholder="Ask Zeus anything…"
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-sm leading-relaxed text-[#f4f4f5]',
            'placeholder:text-[#71717a] focus:outline-none',
            'min-h-[20px] max-h-[120px]',
            'disabled:opacity-50',
          )}
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            aria-label="Stop streaming"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f97316]/20 text-[#f97316] transition-colors hover:bg-[#f97316]/30"
          >
            <Square size={13} fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            aria-label="Send message"
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
              canSubmit
                ? 'bg-[#f97316] text-white hover:bg-[#ea6c0a]'
                : 'bg-white/5 text-[#71717a] cursor-not-allowed',
            )}
          >
            <ArrowUp size={14} />
          </button>
        )}
      </div>
      <p className="mt-1.5 text-center text-[10px] text-[#71717a]">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
};

export const ZeusInput = memo(PureZeusInput);
