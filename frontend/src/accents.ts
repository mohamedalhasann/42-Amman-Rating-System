// The accent colors a student can pick. `on` is the text color that reads on top of it.
// `muted` is how strong secondary text on an accent fill can be while staying at 4.5:1 or more
// (measured per colour; Red has no room to fade, so its secondary text is full strength).
export const ACCENTS: { hex: string; name: string; on: 'ink' | 'paper'; muted: number }[] = [
  { hex: '#00CED1', name: '42 cyan', on: 'ink', muted: 75 },
  { hex: '#5BA4FF', name: 'Sky', on: 'ink', muted: 85 },
  { hex: '#FF6EC7', name: 'Pink', on: 'ink', muted: 85 },
  { hex: '#24387A', name: 'Navy', on: 'paper', muted: 75 },
  { hex: '#EF4444', name: 'Red', on: 'ink', muted: 100 },
  { hex: '#B79CF2', name: 'Lilac', on: 'ink', muted: 85 },
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
  root.setProperty('--on-accent-muted', `color-mix(in srgb, var(--${accent.on}) ${accent.muted}%, transparent)`);
}
