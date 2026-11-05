import { useEffect, useMemo, useState } from 'react';
import type { Stars } from '../api';

export function Wordmark({ size = 26, onInk = false, dotColor = 'var(--accent)' }: { size?: number; onInk?: boolean; dotColor?: string }) {
  return (
    <span style={{ fontSize: size, fontWeight: 700, letterSpacing: '-0.03em', color: onInk ? 'var(--paper)' : 'var(--ink)' }}>
      Fairly<span style={{ color: dotColor }}>.</span>
    </span>
  );
}

const STAR_PATH = 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z';

export function StarIcon({ fill, size = 22, stroke = 'var(--ink)' }: { fill: string; size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={STAR_PATH} fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

// Shows an average like 2.6 as stars, with the last star partly filled.
export function StarMeter({ value, size = 22, emptyFill = '#E3E6E1', stroke = 'var(--ink)' }: {
  value: number; size?: number; emptyFill?: string; stroke?: string;
}) {
  return (
    <span role="img" aria-label={`${value.toFixed(1)} out of 3 stars`} style={{ display: 'inline-flex', gap: 4 }}>
      {[0, 1, 2].map((i) => {
        const part = Math.max(0, Math.min(1, value - i));
        const id = `star-clip-${i}-${Math.round(value * 100)}-${size}`;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <clipPath id={id}>
                <rect x="0" y="0" width={24 * part} height="24" />
              </clipPath>
            </defs>
            <path d={STAR_PATH} fill={emptyFill} />
            <path d={STAR_PATH} fill="var(--accent)" clipPath={`url(#${id})`} />
            <path d={STAR_PATH} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        );
      })}
    </span>
  );
}

export function starWord(stars: Stars) {
  return stars === 1 ? '1 star' : `${stars} stars`;
}

export function initials(first: string, last: string) {
  return (first[0] ?? '') + (last[0] ?? '');
}

// Countdown that trusts the server clock: offset = server time - local time at fetch.
export function useCountdown(endsAt: string | undefined, serverTime: string | undefined) {
  const offset = useMemo(() => (serverTime ? Date.parse(serverTime) - Date.now() : 0), [serverTime]);
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);
  if (!endsAt) return null;
  const ms = Math.max(0, Date.parse(endsAt) - now);
  return {
    ms,
    d: Math.floor(ms / 86_400_000),
    h: Math.floor(ms / 3_600_000) % 24,
    m: Math.floor(ms / 60_000) % 60,
    s: Math.floor(ms / 1000) % 60,
  };
}

export const pad = (n: number) => String(n).padStart(2, '0');

export function Icon({ name, size = 20 }: { name: 'back' | 'close' | 'check' | 'logout' | 'search' | 'lock' | 'eye' | 'scale' | 'clock'; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...p}>
      {name === 'back' && <path d="M15 5l-7 7 7 7" />}
      {name === 'close' && <path d="M6 6l12 12M18 6L6 18" />}
      {name === 'check' && <path d="M5 12.5l4.5 4.5L19 7.5" />}
      {name === 'logout' && <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />}
      {name === 'search' && <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4" />}
      {name === 'lock' && <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />}
      {name === 'eye' && <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />}
      {name === 'scale' && <path d="M12 3v18M7 21h10M4 7h16M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z" />}
      {name === 'clock' && <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2" />}
    </svg>
  );
}
