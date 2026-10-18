import { useState, type FormEvent, type ReactElement } from 'react';
import { useAuth } from '../auth';
import { ApiClient } from '../api';

export function Login(): ReactElement {
  const { login, error: sessionError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending || !username.trim() || !password) return;
    setPending(true);
    setError('');
    try {
      // Demo only: the API verifies the shared account and sets an HttpOnly cookie.
      await login(username.trim(), password);
      setPassword('');
    } catch (cause) {
      setError(ApiClient.errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-page">
      <header className="login-brand">
        <img
          src={`${import.meta.env.BASE_URL}brand/connect981-logo.svg`}
          alt="Connect981"
          width="151"
          height="31"
        />
        <span>NCR Flow</span>
      </header>
      <main className="login-content">
        <form className="panel login-form" onSubmit={(event) => void submit(event)}>
          <p className="eyebrow">QUALITY OPERATIONS DEMO</p>
          <h1>
            Welcome <span className="brand-gradient">back.</span>
          </h1>
          <p className="subtle">Sign in to explore the NCR Flow demo.</p>
          <label htmlFor="login-username">Username</label>
          <input
            id="login-username"
            name="username"
            autoComplete="username"
            required
            autoFocus
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={pending}
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
          />
          {(error || sessionError) && (
            <p className="error" role="alert">
              {error || sessionError}
            </p>
          )}
          <button type="submit" disabled={pending || !username.trim() || !password}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    </div>
  );
}
