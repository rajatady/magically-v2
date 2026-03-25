import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth';

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null });
  });

  it('starts unauthenticated', () => {
    const { token, user, isAuthenticated } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('setAuth stores token and user', () => {
    useAuthStore.getState().setAuth('jwt-token-123', {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
    });

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-token-123');
    expect(state.user?.email).toBe('test@example.com');
    expect(state.isAuthenticated()).toBe(true);
  });

  it('persists token to localStorage', () => {
    useAuthStore.getState().setAuth('jwt-token-123', {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
    });

    expect(localStorage.getItem('magically_token')).toBe('jwt-token-123');
  });

  it('logout clears token and user', () => {
    useAuthStore.getState().setAuth('jwt-token-123', {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('magically_token')).toBeNull();
  });

  it('restores token from localStorage on init', () => {
    localStorage.setItem('magically_token', 'saved-token');
    // Re-create store state by calling restore
    useAuthStore.getState().restore();
    expect(useAuthStore.getState().token).toBe('saved-token');
  });
});
