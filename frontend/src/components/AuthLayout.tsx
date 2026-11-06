import type { ReactNode } from 'react';
import { Wordmark } from './bits';
import { Promises } from './Promises';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <section className="auth__stage">
        <div className="auth__brand">
          <Wordmark size={30} dotColor="var(--ink)" />
          <span className="mono auth__campus">42 Amman</span>
        </div>
        <div className="auth__pitch">
          <h1>Peer ratings,<br />done fairly.</h1>
          <p>Rate the people you learn with, and see where you stand.</p>
        </div>
        <Promises className="auth__promises" />
      </section>
      <main className="auth__panel">
        <div className="auth__form rise">{children}</div>
      </main>
    </div>
  );
}
