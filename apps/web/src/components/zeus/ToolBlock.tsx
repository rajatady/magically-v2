/**
 * Renders a tool_use block — collapsible, with icon, input summary,
 * status dot, and expandable input/result sections.
 * Ported from cc-harness ToolUseDisplay.tsx.
 */
import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { getToolIcon, toolInputSummary, type ZeusBlock } from '@/lib/zeus-blocks';

export const ToolBlock = memo(function ToolBlock({ block }: { block: ZeusBlock & { type: 'tool_use' } }) {
  const [expanded, setExpanded] = useState(false);
  const icon = getToolIcon(block.tool ?? '');
  const isRunning = block.status === 'running';
  const hasChildren = block.children && block.children.length > 0;
  const summary = toolInputSummary(block.tool ?? '', (block.input ?? {}) as Record<string, unknown>);

  return (
    <div className={cn(
      'my-1.5 overflow-hidden rounded-lg border border-border bg-bg-panel',
      block.tool === 'Agent' && 'border-l-2 border-l-accent',
    )}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-bg-hover"
      >
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-mono font-semibold text-text-1">
          {block.tool?.replace('mcp__magically__', '') ?? 'Tool'}
        </span>
        {summary && (
          <span className="flex-1 truncate text-xs font-mono text-text-3">
            {summary}
          </span>
        )}
        {hasChildren && (
          <span className="shrink-0 text-[10px] font-mono text-text-3">
            {block.children!.length} calls
          </span>
        )}
        {isRunning && (
          <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-yellow-500" />
        )}
        {block.status === 'done' && (
          <span className="size-1.5 shrink-0 rounded-full bg-green-500" />
        )}
        {block.status === 'error' && (
          <span className="size-1.5 shrink-0 rounded-full bg-red-500" />
        )}
        <span className="text-[10px] text-text-3">{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Nested children (Agent subagent calls) */}
          {hasChildren && (
            <div className="space-y-1 border-b border-border bg-bg-shell py-2 pl-4 pr-2">
              {block.children!.map((child, i) => (
                <NestedBlock key={child.id ?? `child-${i}`} block={child} />
              ))}
            </div>
          )}

          {/* Input */}
          {!hasChildren && block.input && Object.keys(block.input).length > 0 && (
            <div className="border-b border-border px-3 py-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-text-3">Input</div>
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs text-text-2">
                {JSON.stringify(block.input, null, 2).slice(0, 1000)}
              </pre>
            </div>
          )}

          {/* Result */}
          {block.result && (
            <div className="px-3 py-2">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-text-3">Result</div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-text-2">
                {block.result.slice(0, 2000)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function NestedBlock({ block }: { block: ZeusBlock }) {
  if (block.type === 'text') {
    return <div className="text-xs leading-relaxed text-text-2">{block.text}</div>;
  }
  if (block.type === 'tool_use') {
    return <ToolBlock block={block as ZeusBlock & { type: 'tool_use' }} />;
  }
  return null;
}
