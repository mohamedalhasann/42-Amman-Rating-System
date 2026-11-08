import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordInput, intraLogin } from '../components/PasswordInput';
import { ApiError, isMock } from '../api';
import { useSession } from '../session';

// Arriving from password setup brings a notice and the login, so only the password is left to type.
type LoginState = { notice?: string; username?: string } | null;

export function Login() {
  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const arrived = location.state as LoginState;

  const [username, setUsername] = useState(arrived?.username ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if(busy)return;
    const user = intraLogin(username);
    if (!user || !password) {
      setError(!user ? 'Enter your intra username.' : 'Enter your password.');
      return;
    }
    setUsername(user);
    setBusy(true);
    setError('');
    try {
      const me = await login(user, password);
      if(me?.role==='staff'){window.location.replace('/staff/');return;}
      navigate(me?.profile?.onboarded ? '/' : '/welcome', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <AuthLayout pitch>
      <div className="auth__head">
        <h2>Sign in</h2>
        <p className="muted">Use your 42 intra username.</p>
      </div>
      {arrived?.notice && <p className="auth__notice" role="status">{arrived.notice}</p>}
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="username">Intra username</label>
          <input
            id="username"
            className="input input--mono"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus={!arrived?.username}
            placeholder="anashwan"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setUsername((u) => intraLogin(u))}
          />
        </div>
        <div className="field">
          <div className="field__row">
            <label htmlFor="password">Password</label>
            <Link className="field__link" to="/reset">Forgot password?</Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" autoFocus={!!arrived?.username} value={password} onChange={setPassword} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--accent btn--block" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="auth__alt">
        <p>First time here? <Link to="/setup">Set up your password</Link></p>
      </div>
      {isMock && (
        <p className="demo-hint mono">Demo mode: any username from the roster (try <b>anashwan</b>) with any password.</p>
      )}
    </AuthLayout>
  );
}
