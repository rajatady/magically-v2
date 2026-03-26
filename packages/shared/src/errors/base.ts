/**
 * Base error class for all Magically errors.
 *
 * Rules:
 * - Never expose implementation details (vendor names, internal URLs, tokens)
 * - Always include the phase where the error occurred
 * - `message` is user-facing. `details` is for logs only.
 * - All errors serialize cleanly to JSON for API responses.
 */

export class MagicallyError extends Error {
  constructor(
    message: string,
    public readonly phase: string,
    public readonly details?: string,
  ) {
    super(message);
    this.name = 'MagicallyError';
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      phase: this.phase,
    };
  }

  /** Full error including internal details — for server logs only, never send to client */
  toLog(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      phase: this.phase,
      details: this.details,
      stack: this.stack,
    };
  }
}
