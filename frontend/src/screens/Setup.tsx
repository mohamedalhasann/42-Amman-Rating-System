import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { ApiError, api, isMock } from '../api';

// Step 1 of first-time setup: the server emails a link to the student's 42 address.
export function SetupRequest() {
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    if (!u) return setError('Enter your intra username.');
    setBusy(true);
    setError('');
    try {
      await api.setupRequest(u);
      setSentTo(`${u}@student.42amman.com`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="auth__head">
          <h2>Check your 42 email</h2>
          <p className="muted">
            If this username belongs to a 42 Amman student who hasn’t set a password yet, we sent a setup link to
          </p>
          <p className="mono auth__address">{sentTo}</p>
        </div>
        <p className="muted">The link works once. Didn’t get it? Check spam, or ask staff.</p>
        <Link className="btn btn--ghost btn--block" to="/login">Back to sign in</Link>
        {isMock && (
          <p className="demo-hint mono">
            Demo mode: <Link to="/setup/complete?token=demo">open the setup link</Link>
          </p>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth__head">
        <h2>Set up your password</h2>
        <p className="muted">We’ll email a link to your 42 student address. No other address is ever used.</p>
      </div>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="setup-username">Intra username</label>
          <input
            id="setup-username"
            className="input input--mono"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="anashwan"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--accent btn--block" type="submit" aria-busy={busy}>
          {busy ? 'Sending…' : 'Email me a link'}
        </button>
      </form>
      <p className="auth__alt">
        Already set up? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}

const MIN_PASSWORD = 10;

// Step 2: the student opens the emailed link and chooses a password.
export function SetupComplete() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    setError('');
    try {
      await api.setupComplete(token, password);
      navigate('/login', { replace: true, state: { notice: 'Password set. You can sign in now.' } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="auth__head">
          <h2>This link doesn’t work</h2>
          <p className="muted">It may have expired or been used already. Request a new one.</p>
        </div>
        <Link className="btn btn--accent btn--block" to="/setup">Request a new link</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth__head">
        <h2>Choose a password</h2>
        <p className="muted">At least {MIN_PASSWORD} characters. You’ll use it with your intra username.</p>
      </div>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" className="input" type="password" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Repeat it</label>
          <input id="confirm-password" className="input" type="password" autoComplete="new-password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${Math.min(100, (password.length / MIN_PASSWORD) * 100)}%` }} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--accent btn--block" type="submit" aria-busy={busy}>
          {busy ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </AuthLayout>
  );
}
