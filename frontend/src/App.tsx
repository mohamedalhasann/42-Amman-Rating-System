import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from './session';
import { Login } from './screens/Login';
import { SetupRequest, SetupComplete } from './screens/Setup';
import { Pending } from './screens/Pending';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';

function Splash() {
  return (
    <div className="splash" aria-busy="true">
      <span className="splash__dot" />
    </div>
  );
}

// Decides where a signed-in student belongs: pending approval, first-time setup, or home.
function Guard({ need, children }: { need: 'anonymous' | 'onboarding' | 'home'; children: ReactElement }) {
  const { status, me } = useSession();
  if (status === 'loading') return <Splash />;

  if (need === 'anonymous') {
    if (status === 'ready') return <Navigate to="/" replace />;
    return children;
  }
  if (status !== 'ready' || !me) return <Navigate to="/login" replace />;
  if (me.status === 'pending') return <Pending />;

  const onboarded = !!me.profile?.onboarded;
  if (need === 'onboarding' && onboarded) return <Navigate to="/" replace />;
  if (need === 'home' && !onboarded) return <Navigate to="/welcome" replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Guard need="anonymous"><Login /></Guard>} />
      <Route path="/setup" element={<Guard need="anonymous"><SetupRequest /></Guard>} />
      <Route path="/setup/complete" element={<SetupComplete />} />
      <Route path="/welcome" element={<Guard need="onboarding"><Onboarding /></Guard>} />
      <Route path="/" element={<Guard need="home"><Home /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
