import { MagicallyError } from './base';

export class AgentNotFoundError extends MagicallyError {
  constructor(agentId: string) {
    super(`Agent ${agentId} not found in registry`, 'registry');
    this.name = 'AgentNotFoundError';
  }
}

export class VersionNotFoundError extends MagicallyError {
  constructor(agentId: string, version: string) {
    super(`Version ${version} not found for agent ${agentId}`, 'registry');
    this.name = 'VersionNotFoundError';
  }
}

export class VersionConflictError extends MagicallyError {
  constructor(agentId: string, version: string) {
    super(`Agent ${agentId} already has version ${version}`, 'registry');
    this.name = 'VersionConflictError';
  }
}

export class OwnershipError extends MagicallyError {
  constructor(agentId: string) {
    super(`You are not the author of ${agentId}`, 'registry');
    this.name = 'OwnershipError';
  }
}

export class InstallConflictError extends MagicallyError {
  constructor(agentId: string) {
    super(`Agent ${agentId} is already installed`, 'registry');
    this.name = 'InstallConflictError';
  }
}
