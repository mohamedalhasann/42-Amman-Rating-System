import { useState } from 'react';
import { AuthLayout } from '../components/AuthLayout';
import { useSession } from '../session';

export function Pending() {
  const { me, logout, refresh } = useSession();
  const [checking, setChecking] = useState(false);
  const [still, setStill] = useState(false);
  const [error,setError]=useState('');

  // If staff have approved the account, refreshing the session moves the student on by itself.
  async function check() {
    setChecking(true);
    setStill(false);
    setError('');
    try {
      const next = await refresh();
      if (next?.status === 'pending') setStill(true);
    } catch {
      setError('Couldn’t check your approval. Try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth__head">
        <h2>Almost there, {me?.first_name}</h2>
        <p className="muted">
          Your account is set up and waiting for staff approval. You’ll be able to vote once they approve it.
        </p>
      </div>
      {still && <p className="auth__notice" role="status">Not approved yet. Check again later, or ask 42 Amman staff.</p>}
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="stack">
        <button className="btn btn--accent btn--block" onClick={check} disabled={checking} aria-busy={checking}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
        <button className="btn btn--ghost btn--block" onClick={() => logout().catch(()=>setError('Couldn’t sign out. Try again.'))}>Sign out</button>
      </div>
    </AuthLayout>
  );
}
