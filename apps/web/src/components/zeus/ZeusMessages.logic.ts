import type { UIMessage } from 'ai';

/** Extract concatenated text from all text parts of a message. */
export function extractTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/** True when this message is the last assistant message and a response is actively streaming. */
export function isActiveStream(
  message: UIMessage,
  status: string,
  index: number,
  total: number,
): boolean {
  return (
    (status === 'streaming' || status === 'submitted') &&
    index === total - 1 &&
    message.role === 'assistant'
  );
}

/** True when the user has sent a message and the response hasn't finished. */
export function hasSentMessage(status: string): boolean {
  return status === 'submitted' || status === 'streaming';
}

/** True if the message list is effectively empty (no displayable content). */
export function isEmptyConversation(messages: UIMessage[]): boolean {
  return messages.length === 0;
}
