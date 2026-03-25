import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../lib/api';
import { useAuthStore } from '../lib/auth';

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

  // If CLI started the login, redirect the token back to CLI instead of navigating to /
  const cliRedirect = params.get('cli_redirect');

  const onLoginSuccess = (token: string, user: { id: string; email: string; name: string | null }) => {
    setAuth(token, user);

    if (cliRedirect) {
      // Send token to CLI's local server and show success message
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
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

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
      <div style={{
        width: 380,
        padding: 32,
        background: 'var(--shell-surface, #141416)',
        borderRadius: 16,
        border: '1px solid var(--shell-border, #2a2a2f)',
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={{ color: 'var(--shell-muted, #6b6b76)', fontSize: 14, marginBottom: 24 }}>
          {mode === 'login' ? 'Sign in to Magically' : 'Get started with Magically'}
        </p>

        <a
          href={auth.googleUrl() + (cliRedirect ? `?cli_redirect=${encodeURIComponent(cliRedirect)}` : '')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            width: '100%',
            padding: '10px 0',
            background: '#fff',
            color: '#333',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: 14,
            marginBottom: 20,
            boxSizing: 'border-box',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          Continue with Google
        </a>

        <div style={{
          textAlign: 'center',
          color: 'var(--shell-muted)',
          fontSize: 12,
          marginBottom: 20,
          position: 'relative',
        }}>
          <span style={{ background: 'var(--shell-surface, #141416)', padding: '0 12px', position: 'relative', zIndex: 1 }}>or</span>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'var(--shell-border, #2a2a2f)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
          />

          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 0',
              background: 'var(--shell-accent, #f97316)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--shell-muted)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--shell-accent, #f97316)',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: 13,
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  marginBottom: 12,
  background: 'var(--shell-bg, #0a0a0b)',
  border: '1px solid var(--shell-border, #2a2a2f)',
  borderRadius: 8,
  color: 'var(--shell-text, #e8e8ed)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};
