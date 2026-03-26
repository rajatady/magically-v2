import { MagicallyError } from './base';

export class AuthError extends MagicallyError {
  constructor(reason: string, details?: string) {
    super(reason, 'auth', details);
    this.name = 'AuthError';
  }
}

export class TokenExpiredError extends MagicallyError {
  constructor() {
    super('Authentication token has expired. Please log in again.', 'auth');
    this.name = 'TokenExpiredError';
  }
}

export class InsufficientPermissionsError extends MagicallyError {
  constructor(action: string) {
    super(`Insufficient permissions to ${action}`, 'auth');
    this.name = 'InsufficientPermissionsError';
  }
}
