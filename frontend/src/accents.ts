// The accent colors a student can pick. `on` is the text color that reads on top of it;
// `onInk` is a lighter version for dark surfaces, where a dark accent would disappear.
export const ACCENTS: { hex: string; name: string; on: 'ink' | 'paper'; onInk?: string }[] = [
  { hex: '#00CED1', name: '42 cyan', on: 'ink' },
  { hex: '#5BA4FF', name: 'Sky', on: 'ink' },
  { hex: '#FF6EC7', name: 'Pink', on: 'ink' },
  { hex: '#24387A', name: 'Navy', on: 'paper', onInk: '#8EA5EE' },
  { hex: '#EF4444', name: 'Red', on: 'ink' },
  { hex: '#B79CF2', name: 'Lilac', on: 'ink' },
];

export const DEFAULT_ACCENT = ACCENTS[0].hex;

/** A saved accent that is no longer offered falls back to the default. */
export function knownAccent(hex: string | null | undefined): string {
  const match = ACCENTS.find((a) => a.hex.toLowerCase() === hex?.toLowerCase());
  return match ? match.hex : DEFAULT_ACCENT;
}

export function applyAccent(hex: string) {
  const accent = ACCENTS.find((a) => a.hex === knownAccent(hex))!;
  const root = document.documentElement.style;
  root.setProperty('--accent', accent.hex);
  root.setProperty('--on-accent', `var(--${accent.on})`);
  root.setProperty('--accent-on-ink', accent.onInk ?? accent.hex);
}
