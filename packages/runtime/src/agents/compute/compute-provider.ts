/**
 * Abstract compute provider for running container agents.
 *
 * Only agents with a `runtime` block in their manifest use compute providers.
 * Lightweight agents (no `runtime`) run in-process and bypass this entirely.
 */

export interface ComputeRunInput {
  agentId: string;
  functionName: string;
  image: string;
  cmd: string[];
  env: Record<string, string>;
  timeoutSeconds?: number;
}

export interface ComputeRunOutput {
  exitCode: number;
  logs: string[];
  durationMs: number;
}

export abstract class ComputeProvider {
  abstract readonly name: string;

  /** Run a container, wait for it to finish, return output. */
  abstract run(input: ComputeRunInput): Promise<ComputeRunOutput>;

  /** Check if this provider is available/configured. */
  abstract isAvailable(): Promise<boolean>;

  /** Build (or ensure) the image exists for this provider. */
  abstract buildImage(agentId: string, agentDir: string, dockerfile: string, tag: string): Promise<void>;
}
