import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuthStore } from '~/lib/auth';
import { auth } from '~/lib/api';

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string | undefined,
    cli_redirect: search.cli_redirect as string | undefined,
  }),
});

function AuthCallbackPage() {
  const { token, cli_redirect: cliRedirect } = Route.useSearch();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    if (!token) {
      navigate({ to: '/login' });
      return;
    }

    // Store token temporarily to make the /me call
    useAuthStore.getState().setAuth(token, { id: '', email: '', name: null });

    auth
      .me()
      .then((user) => {
        setAuth(token, { id: user.sub, email: user.email, name: user.name ?? null });

        if (cliRedirect) {
          window.location.href = `${cliRedirect}?token=${encodeURIComponent(token)}`;
        } else {
          navigate({ to: '/' });
        }
      })
      .catch(() => {
        navigate({ to: '/login' });
      });
  }, [token, cliRedirect, navigate, setAuth]);

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      Signing in...
    </div>
  );
}
