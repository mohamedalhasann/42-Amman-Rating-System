import type { ReactNode } from 'react';
import { Wordmark } from './bits';

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
          <p>Rate the people you learn with. Anonymous to everyone but staff.</p>
        </div>
      </section>
      <main className="auth__panel">
        <div className="auth__form rise">{children}</div>
      </main>
    </div>
  );
}
