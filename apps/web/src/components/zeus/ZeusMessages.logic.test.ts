import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import {
  extractTextFromMessage,
  hasSentMessage,
  isActiveStream,
  isEmptyConversation,
} from './ZeusMessages.logic';

function makeMessage(overrides: Partial<UIMessage> = {}): UIMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    parts: [],
    ...overrides,
  };
}

describe('extractTextFromMessage', () => {
  it('extracts text from a single text part', () => {
    const msg = makeMessage({ parts: [{ type: 'text', text: 'Hello world' }] });
    expect(extractTextFromMessage(msg)).toBe('Hello world');
  });

  it('joins multiple text parts', () => {
    const msg = makeMessage({
      parts: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: ' world' },
      ],
    });
    expect(extractTextFromMessage(msg)).toBe('Hello world');
  });

  it('ignores non-text parts', () => {
    const msg = makeMessage({
      parts: [
        { type: 'step-start' },
        { type: 'text', text: 'Answer' },
      ],
    });
    expect(extractTextFromMessage(msg)).toBe('Answer');
  });

  it('returns empty string for message with no text parts', () => {
    const msg = makeMessage({ parts: [{ type: 'step-start' }] });
    expect(extractTextFromMessage(msg)).toBe('');
  });

  it('returns empty string for message with no parts', () => {
    expect(extractTextFromMessage(makeMessage({ parts: [] }))).toBe('');
  });
});

describe('isActiveStream', () => {
  it('true for last assistant message while streaming', () => {
    const msg = makeMessage({ role: 'assistant' });
    expect(isActiveStream(msg, 'streaming', 2, 3)).toBe(true);
  });

  it('true for last assistant message while submitted', () => {
    const msg = makeMessage({ role: 'assistant' });
    expect(isActiveStream(msg, 'submitted', 0, 1)).toBe(true);
  });

  it('false for non-last message', () => {
    const msg = makeMessage({ role: 'assistant' });
    expect(isActiveStream(msg, 'streaming', 0, 3)).toBe(false);
  });

  it('false for user message', () => {
    const msg = makeMessage({ role: 'user' });
    expect(isActiveStream(msg, 'streaming', 2, 3)).toBe(false);
  });

  it('false when status is ready', () => {
    const msg = makeMessage({ role: 'assistant' });
    expect(isActiveStream(msg, 'ready', 2, 3)).toBe(false);
  });
});

describe('hasSentMessage', () => {
  it('true for submitted', () => expect(hasSentMessage('submitted')).toBe(true));
  it('true for streaming', () => expect(hasSentMessage('streaming')).toBe(true));
  it('false for ready', () => expect(hasSentMessage('ready')).toBe(false));
  it('false for error', () => expect(hasSentMessage('error')).toBe(false));
});

describe('isEmptyConversation', () => {
  it('true for empty array', () => expect(isEmptyConversation([])).toBe(true));
  it('false for non-empty', () => {
    expect(isEmptyConversation([makeMessage()])).toBe(false);
  });
});
