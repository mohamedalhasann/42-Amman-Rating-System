import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Icon } from '../components/bits';
import { ApiError, isMock } from '../api';
import { useSession } from '../session';

export function Login() {
  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your intra username and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const me = await login(username.trim(), password);
      navigate(me?.profile?.onboarded ? '/' : '/welcome', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth__head">
        <h2>Sign in</h2>
        <p className="muted">Use your 42 intra username.</p>
      </div>
      {notice && <p className="auth__notice">{notice}</p>}
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="username">Intra username</label>
          <input
            id="username"
            className="input input--mono"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="anashwan"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="password">
            <input
              id="password"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="password__toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              <Icon name="eye" />
            </button>
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--accent btn--block" type="submit" aria-busy={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="auth__alt">
        First time here? <Link to="/setup">Set up your password</Link>
      </p>
      {isMock && (
        <p className="demo-hint mono">Demo mode: any username from the roster (try <b>anashwan</b>) with any password.</p>
      )}
    </AuthLayout>
  );
}
