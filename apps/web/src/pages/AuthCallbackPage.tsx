import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../lib/auth';
import { auth } from '../lib/api';

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login');
      return;
    }

    // Store token, fetch user info, redirect home
    useAuthStore.getState().setAuth(token, { id: '', email: '', name: null });

    auth.me()
      .then((user) => {
        setAuth(token, { id: user.sub, email: user.email, name: user.name ?? null });
        navigate('/');
      })
      .catch(() => {
        navigate('/login');
      });
  }, [params, navigate, setAuth]);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--shell-bg, #0a0a0b)',
      color: 'var(--shell-text, #e8e8ed)',
      fontFamily: '"DM Sans", system-ui, sans-serif',
    }}>
      Signing in...
    </div>
  );
}
