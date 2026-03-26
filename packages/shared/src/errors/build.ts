import { MagicallyError } from './base';

export class ImageBuildError extends MagicallyError {
  constructor(
    public readonly agentId: string,
    public readonly version: string,
    public readonly step: string,
    reason: string,
    details?: string,
  ) {
    super(`Image build failed at "${step}": ${reason}`, 'build', details);
    this.name = 'ImageBuildError';
  }
}

export class RegistryPushError extends MagicallyError {
  constructor(reason: string, details?: string) {
    super(`Failed to push image to registry: ${reason}`, 'registry-push', details);
    this.name = 'RegistryPushError';
  }
}

export class BuildTimeoutError extends MagicallyError {
  constructor(
    public readonly agentId: string,
    public readonly version: string,
    public readonly elapsedSeconds: number,
  ) {
    super(
      `Build timed out after ${elapsedSeconds}s. The build may still be running — check status later.`,
      'build',
    );
    this.name = 'BuildTimeoutError';
  }
}

export class BuildProviderUnavailableError extends MagicallyError {
  constructor(details?: string) {
    super('No build provider is available. Check platform configuration.', 'build', details);
    this.name = 'BuildProviderUnavailableError';
  }
}

export class BuildDispatchError extends MagicallyError {
  constructor(reason: string, details?: string) {
    super(`Failed to start build: ${reason}`, 'build', details);
    this.name = 'BuildDispatchError';
  }
}
