import { memo, useMemo } from 'react';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { ToolBlock } from './ToolBlock';
import { buildBlockTree, type ZeusBlock, type ZeusMessage, type StreamState } from '@/lib/zeus-blocks';
import { useScrollToBottom } from '@/hooks/use-scroll-to-bottom';

interface Props {
  messages: ZeusMessage[];
  stream: StreamState | null;
  streaming: boolean;
}

export const ZeusMessages = memo(function ZeusMessages({ messages, stream, streaming }: Props) {
  const { containerRef, endRef } = useScrollToBottom();

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
      <div className="mx-auto max-w-2xl space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Live streaming area */}
        {streaming && stream && stream.blocks.length > 0 && <StreamingBubble stream={stream} />}

        {/* Thinking dots */}
        {streaming && (!stream || stream.blocks.length === 0) && !stream?.error && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-border bg-bg-card px-4 py-3">
              <div className="flex gap-1.5">
                <span className="size-2 animate-bounce rounded-full bg-text-3 [animation-delay:0ms]" />
                <span className="size-2 animate-bounce rounded-full bg-text-3 [animation-delay:150ms]" />
                <span className="size-2 animate-bounce rounded-full bg-text-3 [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        {/* Result stats */}
        {stream?.result && (
          <div className="text-center font-mono text-[10px] text-text-3">
            <span>{stream.result.turns} turn{stream.result.turns !== 1 ? 's' : ''}</span>
            <span className="mx-1">·</span>
            <span>{(stream.result.durationMs / 1000).toFixed(1)}s</span>
            <span className="mx-1">·</span>
            <span>${stream.result.cost.toFixed(4)}</span>
          </div>
        )}

        {/* Error */}
        {stream?.error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {stream.error}
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
});

const MessageBubble = memo(function MessageBubble({ message }: { message: ZeusMessage }) {
  const isUser = message.role === 'user';

  const treeBlocks = useMemo(() => {
    if (!message.blocks || message.blocks.length === 0) return null;
    return buildBlockTree(message.blocks);
  }, [message.blocks]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'rounded-br-sm bg-accent text-white'
          : 'rounded-bl-sm border border-border bg-bg-card text-text-1'
      }`}>
        {treeBlocks ? (
          treeBlocks.map((block, i) => <RenderBlock key={block.id ?? `b-${i}`} block={block} isStreaming={false} isLast={false} />)
        ) : (
          <div className="text-sm leading-relaxed">
            {isUser ? (
              message.content
            ) : (
              <Streamdown plugins={{ code }} mode="static">{message.content}</Streamdown>
            )}
          </div>
        )}
        <div className={`mt-1.5 text-[10px] ${isUser ? 'text-white/40' : 'text-text-3'}`}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
});

const StreamingBubble = memo(function StreamingBubble({ stream }: { stream: StreamState }) {
  const tree = useMemo(() => buildBlockTree(stream.blocks), [stream.blocks]);

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-bg-card px-4 py-3">
        {stream.status && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-bg-panel px-2 py-1 font-mono text-xs text-yellow-500">
            <span className="size-1.5 animate-pulse rounded-full bg-yellow-500" />
            {stream.status}
          </div>
        )}

        {tree.map((block, i) => (
          <RenderBlock
            key={block.id ?? `s-${i}`}
            block={block}
            isStreaming={true}
            isLast={i === tree.length - 1}
          />
        ))}
      </div>
    </div>
  );
});

function RenderBlock({ block, isStreaming, isLast }: { block: ZeusBlock; isStreaming: boolean; isLast: boolean }) {
  if (block.type === 'text') {
    return (
      <div className="text-sm leading-relaxed">
        <Streamdown
          plugins={{ code }}
          mode={isStreaming ? 'streaming' : 'static'}
          isAnimating={isStreaming && isLast}
          caret={isStreaming && isLast ? 'block' : undefined}
        >
          {block.text ?? ''}
        </Streamdown>
      </div>
    );
  }
  if (block.type === 'tool_use') {
    return <ToolBlock block={block as ZeusBlock & { type: 'tool_use' }} />;
  }
  return null;
}
