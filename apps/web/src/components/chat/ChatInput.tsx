import { memo, useRef, useEffect, useCallback, useState } from 'react';
import { ArrowUp, Square, Paperclip } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileAttachment } from '@magically/shared/types';
import { uploadFile, MAX_TOTAL_FILE_SIZE, type PendingFile } from '@/lib/file-upload';

interface ChatInputProps {
  onSubmit: (text: string, files?: FileAttachment[]) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = memo(function ChatInput({ onSubmit, onStop, streaming, disabled, placeholder = 'Message…' }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [completedFiles, setCompletedFiles] = useState<FileAttachment[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCountRef = useRef(0);

  const isUploading = pendingFiles.some(f => f.status === 'uploading');
  const totalSize = completedFiles.reduce((s, f) => s + f.size, 0)
    + pendingFiles.filter(f => f.status === 'uploading').reduce((s, f) => s + f.file.size, 0);

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  // Clear upload error after 5s
  useEffect(() => {
    if (uploadError) {
      const t = setTimeout(() => setUploadError(null), 5000);
      return () => clearTimeout(t);
    }
  }, [uploadError]);

  // Move completed pending files to completedFiles
  useEffect(() => {
    const done = pendingFiles.filter(f => f.status === 'done' && f.result);
    if (done.length > 0) {
      setCompletedFiles(prev => [...prev, ...done.map(f => f.result!)]);
      setPendingFiles(prev => prev.filter(f => f.status !== 'done'));
    }
  }, [pendingFiles]);

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    for (const file of Array.from(fileList)) {
      if (totalSize + file.size > MAX_TOTAL_FILE_SIZE) {
        setUploadError('Combined file size exceeds 10MB limit.');
        break;
      }

      const id = crypto.randomUUID();
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      setPendingFiles(prev => [...prev, { id, file, progress: 0, status: 'uploading', previewUrl }]);

      try {
        const result = await uploadFile(file, (progress) => {
          setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
        });
        setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'done', result, progress: 100 } : f));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setPendingFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: message } : f));
        setUploadError(message);
      }
    }
  }, [totalSize]);

  const removeCompleted = useCallback((index: number) => {
    setCompletedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removePending = useCallback((id: string) => {
    setPendingFiles(prev => {
      const f = prev.find(p => p.id === id);
      if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return prev.filter(p => p.id !== id);
    });
  }, []);

  // Drag and drop
  useEffect(() => {
    const enter = (e: DragEvent) => { e.preventDefault(); dragCountRef.current++; if (dragCountRef.current === 1) setDragging(true); };
    const leave = (e: DragEvent) => { e.preventDefault(); dragCountRef.current--; if (dragCountRef.current === 0) setDragging(false); };
    const over = (e: DragEvent) => { e.preventDefault(); };
    const drop = (e: DragEvent) => { e.preventDefault(); dragCountRef.current = 0; setDragging(false); if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files); };
    document.addEventListener('dragenter', enter);
    document.addEventListener('dragleave', leave);
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => {
      document.removeEventListener('dragenter', enter);
      document.removeEventListener('dragleave', leave);
      document.removeEventListener('dragover', over);
      document.removeEventListener('drop', drop);
    };
  }, [addFiles]);

  // Paste images
  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length) { e.preventDefault(); addFiles(imgs); }
    };
    document.addEventListener('paste', paste);
    return () => document.removeEventListener('paste', paste);
  }, [addFiles]);

  const handleSubmit = useCallback(() => {
    if (isUploading) return;
    const trimmed = input.trim();
    if (!trimmed && completedFiles.length === 0) return;
    if (streaming) return;
    onSubmit(trimmed || '(attached files)', completedFiles.length > 0 ? completedFiles : undefined);
    setInput('');
    setCompletedFiles([]);
    setPendingFiles([]);
  }, [input, streaming, isUploading, completedFiles, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const canSubmit = (input.trim().length > 0 || completedFiles.length > 0) && !streaming && !isUploading;

  return (
    <>
      {dragging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-bg-shell/80">
          <div className="text-center">
            <div className="mb-2 text-4xl">📎</div>
            <p className="text-lg font-semibold text-accent">Drop files here</p>
            <p className="text-xs text-text-3">Max 10MB combined</p>
          </div>
        </div>
      )}

      <div className="shrink-0 border-t border-border px-3 py-3">
        {uploadError && (
          <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400">{uploadError}</div>
        )}

        {(completedFiles.length > 0 || pendingFiles.length > 0) && (
          <div className="mb-2 flex flex-wrap gap-2">
            {completedFiles.map((file, i) => (
              <div key={`done-${i}`} className="flex items-center gap-1.5 rounded-lg border border-border bg-bg-panel px-2 py-1 text-xs">
                {file.type.startsWith('image/')
                  ? <img src={file.url} alt={file.name} className="size-8 rounded object-cover" />
                  : <span className="text-sm">📄</span>
                }
                <span className="max-w-[100px] truncate text-text-2">{file.name}</span>
                <span className="text-text-3">{(file.size / 1024).toFixed(0)}KB</span>
                <button onClick={() => removeCompleted(i)} className="text-text-3 hover:text-red-400">×</button>
              </div>
            ))}
            {pendingFiles.map((pf) => (
              <div key={pf.id} className="relative flex items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-bg-panel px-2 py-1 text-xs">
                {pf.status === 'uploading' && (
                  <div className="absolute inset-0 bg-accent/10 transition-all" style={{ width: `${pf.progress}%` }} />
                )}
                <div className="relative flex items-center gap-1.5">
                  {pf.previewUrl
                    ? <img src={pf.previewUrl} alt={pf.file.name} className="size-8 rounded object-cover opacity-60" />
                    : <span className="text-sm opacity-60">📄</span>
                  }
                  <span className="max-w-[80px] truncate text-text-3">{pf.file.name}</span>
                  {pf.status === 'uploading' && <span className="font-mono text-accent">{pf.progress}%</span>}
                  {pf.status === 'error' && <span className="text-red-400">failed</span>}
                  <button onClick={() => removePending(pf.id)} className="text-text-3 hover:text-red-400">×</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl bg-bg-card px-3 py-2.5">
          <input ref={fileInputRef} type="file" multiple className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-3 transition-colors hover:bg-bg-hover hover:text-text-2"
          >
            <Paperclip size={15} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled && !streaming}
            placeholder={placeholder}
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
          Enter to send · Shift+Enter for newline · Drop or paste files
        </p>
      </div>
    </>
  );
});
