import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/auth';
import { auth } from '../lib/api';
import { Spinner } from '@/components/ui/spinner';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = params.get('token');
    const cliRedirect = params.get('cli_redirect');

    if (!token) {
      navigate('/login');
      return;
    }

    useAuthStore.getState().setAuth(token, { id: '', email: '', name: null });

    auth.me()
      .then((user) => {
        setAuth(token, { id: user.sub, email: user.email, name: user.name ?? null });

        if (cliRedirect) {
          window.location.href = `${cliRedirect}?token=${encodeURIComponent(token)}`;
        } else {
          navigate('/');
        }
      })
      .catch(() => {
        navigate('/login');
      });
  }, [params, navigate, setAuth]);

  return (
    <div className="flex h-screen items-center justify-center bg-bg-shell font-body text-text-1">
      <Spinner className="mr-2 size-5" />
      Signing in...
    </div>
  );
}
