import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { Icon } from '../components/bits';
import { PasswordInput, intraLogin } from '../components/PasswordInput';
import { ApiError, api, isMock } from '../api';
import { clearLinkToken, readLinkToken } from '../link-token';

const RESEND_AFTER = 30; // seconds

// First-time setup and password reset are the same two steps: email a link to the student's
// 42 address, then choose a password. Only the wording and the endpoints differ.
type Mode = 'setup' | 'reset';
const COPY = {
  setup: {
    title: 'Set up your password',
    lead: 'We’ll email a link to your registered 42 campus address.',
    sent: 'If this account is eligible for setup, a link will be sent to its registered 42 campus email.',
    alt: 'Already set up?',
    choose: 'Choose a password',
    done: 'Password set. Sign in to continue.',
  },
  reset: {
    title: 'Reset your password',
    lead: 'We’ll email a reset link to your registered 42 campus address.',
    sent: 'If this account is eligible for recovery, a link will be sent to its registered 42 campus email.',
    alt: 'Remembered it?',
    choose: 'Choose a new password',
    done: 'Password changed. Sign in with your new one.',
  },
} as const;

// Step 1: the server emails a link to the student's 42 address.
export function SetupRequest({ mode = 'setup' }: { mode?: Mode }) {
  const copy = COPY[mode];
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(t);
  }, [wait]);

  async function send(u: string) {
    setBusy(true);
    setError('');
    try {
      await (mode === 'reset' ? api.resetRequest(u) : api.setupRequest(u));
      setSentTo(u);
      setWait(RESEND_AFTER);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const u = intraLogin(username);
    if (!u) return setError('Enter your intra username.');
    setUsername(u);
    setResent(false);
    await send(u);
  }

  async function resend() {
    if (await send(sentTo)) setResent(true);
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <div className="auth__head">
          <h2>Check your 42 email</h2>
          <p className="muted">
            {copy.sent}
          </p>
          <p className="mono auth__address">@{sentTo}</p>
        </div>
        <p className="muted">The link works once. Didn’t get it? Check spam, then send it again.</p>
        {resent && <p className="auth__notice" role="status">Sent again.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="stack">
          <button className="btn btn--accent btn--block" onClick={resend} disabled={wait > 0 || busy} aria-busy={busy}>
            {busy ? 'Sending…' : wait > 0 ? `Send again in ${wait}s` : 'Send again'}
          </button>
          <button className="btn btn--ghost btn--block" onClick={() => { setSentTo(''); setResent(false); setError(''); }}>
            Use a different username
          </button>
        </div>
        <div className="auth__alt">
          <p><Link to="/login">Back to sign in</Link></p>
          <p className="muted">Still nothing? Ask 42 Amman staff.</p>
        </div>
        {isMock && (
          <p className="demo-hint mono">
            Demo mode: <Link to={`/${mode}/complete?token=demo`}>open the link</Link> · <Link to={`/${mode}/complete?token=expired`}>expired link</Link>
          </p>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth__head">
        <h2>{copy.title}</h2>
        <p className="muted">{copy.lead}</p>
      </div>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="setup-username">Intra username</label>
          <input
            id="setup-username"
            className="input input--mono"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            placeholder="anashwan"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setUsername((u) => intraLogin(u))}
          />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--accent btn--block" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Sending…' : 'Email me a link'}
        </button>
      </form>
      <div className="auth__alt">
        <p>{copy.alt} <Link to="/login">Sign in</Link></p>
      </div>
    </AuthLayout>
  );
}

const MIN_PASSWORD = 10;

// Step 2: the student opens the emailed link and chooses a password.
export function SetupComplete({ mode = 'setup' }: { mode?: Mode }) {
  const copy = COPY[mode];
  const [token] = useState(readLinkToken);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(!token);

  const longEnough = password.length >= MIN_PASSWORD;
  const matches = confirm.length > 0 && confirm === password;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!longEnough) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (!matches) return setError('The two passwords don’t match.');
    setBusy(true);
    setError('');
    try {
      const res = await (mode === 'reset' ? api.resetComplete(token, password) : api.setupComplete(token, password));
      clearLinkToken();
      navigate('/login', {
        replace: true,
        state: { notice: copy.done, username: res?.intra_username },
      });
    } catch (err) {
      if (err instanceof ApiError && ['INVALID_TOKEN','INVALID_SETUP_LINK'].includes(err.code)){clearLinkToken();return setExpired(true);}
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <AuthLayout>
        <div className="auth__head">
          <h2>This link doesn’t work</h2>
          <p className="muted">It may have expired or been used already. Request a new one, it only takes a moment.</p>
        </div>
        <Link className="btn btn--accent btn--block" to={`/${mode}`}>Request a new link</Link>
        <div className="auth__alt">
          <p>{mode === 'reset' ? 'Changed it already?' : 'Already set your password?'} <Link to="/login">Sign in</Link></p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth__head">
        <h2>{copy.choose}</h2>
        <p className="muted">You’ll use it with your intra username.</p>
      </div>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <PasswordInput id="new-password" autoComplete="new-password" autoFocus value={password} onChange={setPassword} describedBy="password-rules" />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Repeat it</label>
          <PasswordInput id="confirm-password" autoComplete="new-password" value={confirm} onChange={setConfirm} describedBy="password-rules" />
        </div>
        <ul className="checks" id="password-rules">
          <li className={longEnough ? 'is-met' : ''}>
            <span className="checks__mark" aria-hidden="true">{longEnough && <Icon name="check" size={14} />}</span>
            At least {MIN_PASSWORD} characters
          </li>
          <li className={matches ? 'is-met' : ''}>
            <span className="checks__mark" aria-hidden="true">{matches && <Icon name="check" size={14} />}</span>
            Both passwords match
          </li>
        </ul>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn--accent btn--block" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </AuthLayout>
  );
}
