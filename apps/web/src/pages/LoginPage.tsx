import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/api';
import { useAuthStore } from '../lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const cliRedirect = params.get('cli_redirect');

  const onLoginSuccess = (token: string, user: { id: string; email: string; name: string | null }) => {
    setAuth(token, user);
    if (cliRedirect) {
      window.location.href = `${cliRedirect}?token=${encodeURIComponent(token)}`;
    } else {
      navigate('/');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = mode === 'login'
        ? await auth.login(email, password)
        : await auth.signup(email, password, name);

      onLoginSuccess(result.accessToken, {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-bg-shell font-body text-text-1">
      <div className="w-[380px] rounded-2xl border border-border bg-bg-panel p-8">
        <h1 className="mb-2 text-2xl font-semibold">
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p className="mb-6 text-sm text-text-3">
          {mode === 'login' ? 'Sign in to Magically' : 'Get started with Magically'}
        </p>

        <a
          href={auth.googleUrl() + (cliRedirect ? `?cli_redirect=${encodeURIComponent(cliRedirect)}` : '')}
          className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-lg bg-white py-2.5 text-sm font-medium text-gray-800 no-underline"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </a>

        <div className="relative mb-5 text-center text-xs text-text-3">
          <span className="relative z-10 bg-bg-panel px-3">or</span>
          <Separator className="absolute left-0 right-0 top-1/2" />
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <Input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-3 bg-bg-shell"
            />
          )}
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mb-3 bg-bg-shell"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="mb-3 bg-bg-shell"
          />

          {error && (
            <p className="mb-3 text-sm text-red-500">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-[13px] text-text-3">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <Button
            variant="link"
            size="sm"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            className="h-auto p-0 text-[13px] text-accent"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </Button>
        </p>
      </div>
    </div>
  );
}
