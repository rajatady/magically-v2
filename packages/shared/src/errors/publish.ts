import { MagicallyError } from './base';

export class ValidationError extends MagicallyError {
  constructor(
    message: string,
    public readonly checks: Array<{ check: string; message: string }>,
  ) {
    super(message, 'validation');
    this.name = 'ValidationError';
  }
}

export class BundleUploadError extends MagicallyError {
  constructor(reason: string, details?: string) {
    super(`Bundle upload failed: ${reason}`, 'upload', details);
    this.name = 'BundleUploadError';
  }
}

export class BundleDownloadError extends MagicallyError {
  constructor(reason: string, details?: string) {
    super(`Bundle download failed: ${reason}`, 'upload', details);
    this.name = 'BundleDownloadError';
  }
}

export class DuplicateVersionError extends MagicallyError {
  constructor(agentId: string, version: string) {
    super(`Version ${version} already exists for agent ${agentId}`, 'publish');
    this.name = 'DuplicateVersionError';
  }
}
