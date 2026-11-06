import type { ReactNode } from 'react';
import { Character, PRESETS } from './Character';
import { Wordmark } from './bits';
import type { CharacterSpec } from '../api';

// A "group photo" of 42 students in their hoodies. Purely decorative.
const CROWD: { spec: CharacterSpec; accent: string }[] = [
  { spec: PRESETS.girl[0], accent: '#F2A541' },
  { spec: PRESETS.boy[1], accent: '#B79CF2' },
  { spec: PRESETS.girl[1], accent: '#F4F5F2' },
  { spec: PRESETS.boy[3], accent: '#8FD16A' },
  { spec: PRESETS.girl[2], accent: '#FF8A80' },
  { spec: PRESETS.boy[2], accent: '#5BA4FF' },
  { spec: PRESETS.girl[4], accent: '#F4F5F2' },
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
