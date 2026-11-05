import type { ReactNode } from 'react';
import { Character } from './Character';
import { Wordmark } from './bits';
import type { CharacterSpec } from '../api';

// A "group photo" of 42 students in their hoodies. Purely decorative.
const CROWD: { spec: CharacterSpec; accent: string }[] = [
  { spec: { skin: 1, hair: 2, eyes: 1, item: 0 }, accent: '#F2A541' },
  { spec: { skin: 3, hair: 1, eyes: 0, item: 1 }, accent: '#B79CF2' },
  { spec: { skin: 0, hair: 0, eyes: 3, item: 2 }, accent: '#F4F5F2' },
  { spec: { skin: 4, hair: 3, eyes: 4, item: 0 }, accent: '#8FD16A' },
  { spec: { skin: 2, hair: 4, eyes: 1, item: 1 }, accent: '#FF8A80' },
  { spec: { skin: 1, hair: 0, eyes: 2, item: 3 }, accent: '#5BA4FF' },
  { spec: { skin: 3, hair: 2, eyes: 0, item: 0 }, accent: '#F4F5F2' },
];

export function Crowd() {
  return (
    <div className="crowd" aria-hidden="true">
      {CROWD.map((c, i) => (
        <div key={i} className="crowd__person" style={{ animationDelay: `${i * 0.35}s` }}>
          <Character spec={c.spec} accent={c.accent} size="100%" />
        </div>
      ))}
    </div>
  );
}

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
        <Crowd />
      </section>
      <main className="auth__panel">
        <div className="auth__form rise">{children}</div>
      </main>
    </div>
  );
}
