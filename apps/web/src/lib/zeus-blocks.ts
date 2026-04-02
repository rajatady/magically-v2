/**
 * Pure functions for building the ordered block tree from Zeus SDK events.
 * Ported from cc-harness/packages/web/src/lib/blockTree.ts.
 * No React — fully testable.
 */

export interface ZeusBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  tool?: string;
  input?: Record<string, unknown>;
  result?: string;
  status?: 'running' | 'done' | 'error';
  parentToolUseId?: string | null;
  children?: ZeusBlock[];
}

export interface ZeusMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blocks?: ZeusBlock[];
  files?: Array<{ name: string; type: string; url: string; size: number }>;
  createdAt: string;
}

export interface StreamState {
  blocks: ZeusBlock[];
  status: string | null;
  result: { cost: number; turns: number; durationMs: number; usage: unknown } | null;
  error: string | null;
}

export function createEmptyStreamState(): StreamState {
  return { blocks: [], status: null, result: null, error: null };
}

/**
 * Builds a tree from flat ordered blocks using parentToolUseId.
 * Top-level blocks stay at root. Blocks with parentToolUseId
 * become children of that tool_use block.
 */
export function buildBlockTree(flatBlocks: ZeusBlock[]): ZeusBlock[] {
  const toolUseMap = new Map<string, ZeusBlock>();
  for (const block of flatBlocks) {
    if (block.type === 'tool_use' && block.id) {
      block.children = [];
      toolUseMap.set(block.id, block);
    }
  }

  const roots: ZeusBlock[] = [];

  for (const block of flatBlocks) {
    const parentId = block.parentToolUseId;
    if (parentId && toolUseMap.has(parentId)) {
      const parent = toolUseMap.get(parentId)!;
      if (!parent.children) parent.children = [];
      parent.children.push(block);
    } else {
      roots.push(block);
    }
  }

  return roots;
}

/** Get or create the trailing text block in the blocks array */
function ensureTextBlock(blocks: ZeusBlock[]): ZeusBlock & { type: 'text' } {
  const last = blocks[blocks.length - 1];
  if (last && last.type === 'text') return last as ZeusBlock & { type: 'text' };
  const block: ZeusBlock = { type: 'text', text: '' };
  blocks.push(block);
  return block as ZeusBlock & { type: 'text' };
}

/**
 * Apply a chunk event to stream state.
 * The server sends accumulated full text — we diff to get the delta.
 */
export function applyChunk(state: StreamState, fullText: string): void {
  const existingText = state.blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  if (fullText.length > existingText.length) {
    const delta = fullText.slice(existingText.length);
    const textBlock = ensureTextBlock(state.blocks);
    textBlock.text = (textBlock.text ?? '') + delta;
  }
}

/**
 * Apply a tool:start event to stream state.
 * Deduplicates — the same tool can fire twice (stream_event + assistant message).
 */
export function applyToolStart(state: StreamState, id: string, tool: string, input: Record<string, unknown>): void {
  const existing = state.blocks.find((b) => b.type === 'tool_use' && b.id === id);
  if (existing && existing.type === 'tool_use') {
    existing.input = input;
  } else {
    state.blocks.push({ type: 'tool_use', id, tool, input, status: 'running' });
  }
}

/**
 * Apply a tool:result event to stream state.
 */
export function applyToolResult(state: StreamState, id: string, result: string): void {
  const block = state.blocks.find((b) => b.type === 'tool_use' && b.id === id);
  if (block && block.type === 'tool_use') {
    block.result = result;
    block.status = 'done';
  }
}

/**
 * Extract plain text from blocks for storage.
 */
export function extractPlainText(blocks: ZeusBlock[]): string {
  return blocks
    .filter((b): b is ZeusBlock & { type: 'text' } => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('\n');
}

/** Smart input summary for a tool block — shows the most relevant field */
export function toolInputSummary(tool: string, input: Record<string, unknown>): string {
  if ((tool === 'Read' || tool === 'Edit' || tool === 'Write') && input.file_path) return String(input.file_path);
  if (tool === 'Bash' && input.command) return String(input.command).slice(0, 80);
  if (tool === 'Glob' && input.pattern) return String(input.pattern);
  if (tool === 'Grep' && input.pattern) return String(input.pattern);
  if (tool === 'Agent' && input.description) return String(input.description).slice(0, 60);
  // MCP tools — show the tool name without prefix
  if (tool.startsWith('mcp__magically__')) return tool.replace('mcp__magically__', '');
  return '';
}

export const TOOL_ICONS: Record<string, string> = {
  Read: '📄', Edit: '✏️', Write: '📝', Bash: '⚡', Glob: '🔍',
  Grep: '🔎', WebFetch: '🌐', WebSearch: '🔎', Agent: '🤖',
};

export function getToolIcon(toolName: string): string {
  if (toolName.startsWith('mcp__')) return '🔧';
  return TOOL_ICONS[toolName] ?? '🔧';
}
