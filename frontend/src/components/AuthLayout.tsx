import type { ReactNode } from 'react';
import { Wordmark } from './bits';
import { Promises } from './Promises';
import { CampusLogo } from './CampusLogo';
import { Kitten } from './Kitten';

// `pitch` shows the headline and promises; on phones the other steps use a slim header instead.
export function AuthLayout({ children, pitch = false }: { children: ReactNode; pitch?: boolean }) {
  return (
    <div className={`auth ${pitch ? '' : 'auth--slim'}`}>
      <section className="auth__stage">
        <div className="auth__brand">
          <Wordmark size={30} color="var(--on-accent)" dotColor="var(--on-accent)" />
          <CampusLogo height={58} className="auth__campus" />
        </div>
        <div className="auth__pitch">
          <h1>Peer ratings,<br />done fairly.</h1>
        </div>
        <Promises className="auth__promises" />
        <div className="auth__pet">
          <Kitten scale={3} pettable />
        </div>
      </section>
      <main className="auth__panel">
        <div className="auth__form rise">{children}</div>
      </main>
    </div>
  );
}
