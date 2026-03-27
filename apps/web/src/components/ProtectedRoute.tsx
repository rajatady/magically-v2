import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../lib/auth';
import { auth } from '../lib/api';
import { Spinner } from '@/components/ui/spinner';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isRestoring, isAuthenticated, setAuth, logout, setRestoring } = useAuthStore();

  // On startup, validate the stored token against the server and hydrate the user
  useEffect(() => {
    if (!isRestoring) return;

    auth
      .me()
      .then((payload) => setAuth(token!, { id: payload.sub, email: payload.email, name: payload.name ?? null }))
      .catch(() => logout());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isRestoring) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg-shell">
        <Spinner className="size-6 text-accent" />
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
