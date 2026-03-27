import { describe, expect, it } from 'vitest';
import {
  buildBlockTree,
  applyChunk,
  applyToolStart,
  applyToolResult,
  extractPlainText,
  toolInputSummary,
  getToolIcon,
  createEmptyStreamState,
  type ZeusBlock,
} from './zeus-blocks';

describe('buildBlockTree', () => {
  it('keeps top-level blocks at root', () => {
    const blocks: ZeusBlock[] = [
      { type: 'text', text: 'hello' },
      { type: 'tool_use', id: 't1', tool: 'Read', status: 'done' },
    ];
    const tree = buildBlockTree(blocks);
    expect(tree).toHaveLength(2);
  });

  it('nests children under parent tool_use', () => {
    const blocks: ZeusBlock[] = [
      { type: 'tool_use', id: 'agent-1', tool: 'Agent', status: 'done' },
      { type: 'tool_use', id: 'child-1', tool: 'Read', status: 'done', parentToolUseId: 'agent-1' },
      { type: 'text', text: 'sub-result', parentToolUseId: 'agent-1' },
    ];
    const tree = buildBlockTree(blocks);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children![0].tool).toBe('Read');
    expect(tree[0].children![1].text).toBe('sub-result');
  });

  it('handles empty array', () => {
    expect(buildBlockTree([])).toEqual([]);
  });
});

describe('applyChunk', () => {
  it('appends new text delta', () => {
    const state = createEmptyStreamState();
    applyChunk(state, 'Hello');
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0].text).toBe('Hello');
  });

  it('extracts delta from accumulated text', () => {
    const state = createEmptyStreamState();
    applyChunk(state, 'Hello');
    applyChunk(state, 'Hello world');
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0].text).toBe('Hello world');
  });

  it('does not duplicate when same text sent again', () => {
    const state = createEmptyStreamState();
    applyChunk(state, 'Hello');
    applyChunk(state, 'Hello');
    expect(state.blocks[0].text).toBe('Hello');
  });
});

describe('applyToolStart', () => {
  it('adds a new tool_use block', () => {
    const state = createEmptyStreamState();
    applyToolStart(state, 't1', 'Read', { file_path: '/foo.ts' });
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0].tool).toBe('Read');
    expect(state.blocks[0].status).toBe('running');
  });

  it('deduplicates — updates input on second call', () => {
    const state = createEmptyStreamState();
    applyToolStart(state, 't1', 'Read', {});
    applyToolStart(state, 't1', 'Read', { file_path: '/bar.ts' });
    expect(state.blocks).toHaveLength(1);
    expect((state.blocks[0].input as Record<string, unknown>).file_path).toBe('/bar.ts');
  });
});

describe('applyToolResult', () => {
  it('marks tool as done with result', () => {
    const state = createEmptyStreamState();
    applyToolStart(state, 't1', 'Bash', { command: 'echo hi' });
    applyToolResult(state, 't1', 'hi');
    expect(state.blocks[0].status).toBe('done');
    expect(state.blocks[0].result).toBe('hi');
  });

  it('ignores result for unknown tool id', () => {
    const state = createEmptyStreamState();
    applyToolResult(state, 'unknown', 'result');
    expect(state.blocks).toHaveLength(0);
  });
});

describe('extractPlainText', () => {
  it('joins text blocks', () => {
    const blocks: ZeusBlock[] = [
      { type: 'text', text: 'Hello' },
      { type: 'tool_use', id: 't1', tool: 'Read', status: 'done' },
      { type: 'text', text: 'World' },
    ];
    expect(extractPlainText(blocks)).toBe('Hello\nWorld');
  });

  it('returns empty for no text blocks', () => {
    expect(extractPlainText([{ type: 'tool_use', id: 't1', tool: 'Read', status: 'done' }])).toBe('');
  });
});

describe('toolInputSummary', () => {
  it('returns file_path for Read', () => {
    expect(toolInputSummary('Read', { file_path: '/foo.ts' })).toBe('/foo.ts');
  });

  it('returns command for Bash', () => {
    expect(toolInputSummary('Bash', { command: 'npm test' })).toBe('npm test');
  });

  it('strips mcp prefix for magically tools', () => {
    expect(toolInputSummary('mcp__magically__ListAgents', {})).toBe('ListAgents');
  });

  it('returns empty for unknown tool', () => {
    expect(toolInputSummary('CustomTool', {})).toBe('');
  });
});

describe('getToolIcon', () => {
  it('returns correct icon for known tools', () => {
    expect(getToolIcon('Read')).toBe('📄');
    expect(getToolIcon('Bash')).toBe('⚡');
  });

  it('returns wrench for MCP tools', () => {
    expect(getToolIcon('mcp__magically__ListAgents')).toBe('🔧');
  });
});
