/**
 * Shared execute wrapper for Zeus chat tools.
 * Not a type wrapper — each tool calls tool() directly.
 * This just standardizes error handling and optional telemetry.
 */
export async function safeExecute<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Tool execution failed';
    return { error: message };
  }
}
