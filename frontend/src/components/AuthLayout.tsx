import type { ReactNode } from 'react';
import { Character, normalizeSpec } from './Character';
import { Wordmark } from './bits';
import type { CharacterSpec } from '../api';

// A "group photo" of 42 students in their hoodies. Purely decorative.
const P = (s: Partial<CharacterSpec>): CharacterSpec => normalizeSpec(s);
const CROWD: { spec: CharacterSpec; accent: string }[] = [
  { spec: P({ skin: 1, hair: 6, hairColor: 2, eyes: 1 }), accent: '#F2A541' },
  { spec: P({ skin: 2, hair: 0, beard: 2, glasses: 1, mouth: 1 }), accent: '#B79CF2' },
  { spec: P({ skin: 1, hijab: 1, hijabColor: 2, capColor: 2 }), accent: '#F4F5F2' },
  { spec: P({ skin: 4, hair: 3, hairColor: 0, eyes: 3, mouth: 1 }), accent: '#8FD16A' },
  { spec: P({ skin: 3, hijab: 2, hijabColor: 3, capColor: 3, glasses: 2 }), accent: '#FF8A80' },
  { spec: P({ skin: 0, hair: 5, hairColor: 3, eyes: 0 }), accent: '#5BA4FF' },
  { spec: P({ skin: 2, hair: 2, hairColor: 1, beard: 1, glasses: 3 }), accent: '#F4F5F2' },
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
