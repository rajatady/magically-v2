import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCopyToClipboardOptions {
  timeout?: number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useCopyToClipboard({
  timeout = 2000,
  onSuccess,
  onError,
}: UseCopyToClipboardOptions = {}) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const timeoutRef_ = useRef(timeout);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  timeoutRef_.current = timeout;

  const copyToClipboard = useCallback(
    async (value: string) => {
      if (typeof window === 'undefined' || !navigator.clipboard?.writeText) {
        onErrorRef.current?.(new Error('Clipboard API unavailable.'));
        return;
      }

      if (!value) return;

      try {
        await navigator.clipboard.writeText(value);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        setIsCopied(true);
        onSuccessRef.current?.();

        if (timeoutRef_.current !== 0) {
          timeoutRef.current = setTimeout(() => {
            setIsCopied(false);
            timeoutRef.current = null;
          }, timeoutRef_.current);
        }
      } catch (error) {
        if (onErrorRef.current) {
          onErrorRef.current(error instanceof Error ? error : new Error(String(error)));
        }
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { copyToClipboard, isCopied };
}
