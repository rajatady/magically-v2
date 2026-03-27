import { describe, expect, it, vi, beforeEach } from 'vitest';

const hasDom = typeof globalThis.document !== 'undefined';
const maybeDescribe = hasDom ? describe : describe.skip;

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../lib/auth';
import { ProtectedRoute } from './ProtectedRoute';

// Mock the API so the useEffect doesn't make real calls
vi.mock('../lib/api', () => ({
  auth: { me: vi.fn(() => new Promise(() => {})) },
}));

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

maybeDescribe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isRestoring: false });
  });

  it('shows spinner when isRestoring is true', () => {
    useAuthStore.setState({ token: 'tok', isRestoring: true });
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('redirects to /login when not authenticated', () => {
    useAuthStore.setState({ token: null, user: null, isRestoring: false });
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    );
    expect(screen.queryByText('Protected content')).toBeNull();
  });

  it('renders children when authenticated', () => {
    useAuthStore.setState({
      token: 'valid',
      user: { id: '1', email: 'a@b.c', name: 'Test' },
      isRestoring: false,
    });
    renderWithRouter(
      <ProtectedRoute>
        <div>Protected content</div>
      </ProtectedRoute>,
    );
    expect(screen.getByText('Protected content')).toBeDefined();
  });
});
