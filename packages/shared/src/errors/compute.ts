import { MagicallyError } from './base';

export class ComputeError extends MagicallyError {
  constructor(
    public readonly agentId: string,
    public readonly functionName: string,
    reason: string,
    details?: string,
  ) {
    super(`Agent execution failed: ${reason}`, 'compute', details);
    this.name = 'ComputeError';
  }
}

export class ComputeTimeoutError extends MagicallyError {
  constructor(
    public readonly agentId: string,
    public readonly functionName: string,
    public readonly elapsedSeconds: number,
  ) {
    super(
      `Agent function ${functionName} timed out after ${elapsedSeconds}s`,
      'compute',
    );
    this.name = 'ComputeTimeoutError';
  }
}

export class SandboxCreationError extends MagicallyError {
  constructor(reason: string, details?: string) {
    super(`Failed to create execution environment: ${reason}`, 'compute', details);
    this.name = 'SandboxCreationError';
  }
}

export class ImageNotFoundError extends MagicallyError {
  constructor(agentId: string, version: string) {
    super(
      `No built image found for ${agentId}@${version}. Has it been published?`,
      'compute',
    );
    this.name = 'ImageNotFoundError';
  }
}

export class SnapshotCreationError extends MagicallyError {
  constructor(reason: string, details?: string) {
    super(`Failed to prepare execution snapshot: ${reason}`, 'compute', details);
    this.name = 'SnapshotCreationError';
  }
}
