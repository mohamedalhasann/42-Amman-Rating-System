import { AuthLayout } from '../components/AuthLayout';
import { useSession } from '../session';

export function Pending() {
  const { me, logout } = useSession();
  return (
    <AuthLayout>
      <div className="auth__head">
        <h2>Almost there, {me?.first_name}</h2>
        <p className="muted">
          Your account is set up and waiting for staff approval. You’ll be able to sign in and vote once they approve it.
        </p>
      </div>
      <button className="btn btn--ghost btn--block" onClick={() => logout()}>Sign out</button>
    </AuthLayout>
  );
}
