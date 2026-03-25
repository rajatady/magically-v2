// ─── Agent Context ──────────────────────────────────────────────────────────
// This is what every agent function receives when it runs.
// The runtime builds this and injects it. The agent never constructs it.

export interface AgentLog {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface AgentContext {
  /** Agent ID */
  agentId: string;

  /** Absolute path to the agent's directory */
  agentDir: string;

  /** Why this function was invoked */
  trigger: {
    type: 'schedule' | 'event' | 'manual' | 'programmatic';
    /** For event triggers, the event name. For schedule, the cron expression. */
    source?: string;
    /** Arbitrary payload passed by the caller */
    payload?: Record<string, unknown>;
  };

  /** Agent's user-facing config values (from manifest config schema + user overrides) */
  config: Record<string, unknown>;

  /** Structured logging — all output is captured by the runtime */
  log: AgentLog;

  /** Emit events to the runtime (feed posts, widget updates, custom events) */
  emit(event: string, data?: unknown): void;

  /** Agent's secrets (API keys etc., declared in manifest, stored by runtime) */
  secrets: Record<string, string>;

  /** LLM access — ask a question, get an answer */
  llm: {
    ask(prompt: string): Promise<string>;
    askWithSystem(systemPrompt: string, userPrompt: string): Promise<string>;
  };
}

/**
 * Every agent function file must default-export a function with this signature.
 * The function receives AgentContext and returns a result (or void).
 */
export type AgentFunctionHandler = (
  ctx: AgentContext,
  params?: Record<string, unknown>,
) => Promise<unknown>;
