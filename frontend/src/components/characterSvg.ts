import type { CharacterSpec } from '../api';
import { HIJAB_ART, LOGO_ART } from './characterArt';

// A character is a stack of SVG parts on one 160 x 160 canvas.
// renderCharacter() returns the inner markup so it can be used by React and by tests alike.

export const SKINS = ['#F6D7BD', '#E8B895', '#C98E66', '#A86E46', '#8A5634', '#5E3A22'];
export const HAIRS = ['Textured', 'Buzz', 'Side part', 'Curly', 'Long', 'Bun', 'Bob', 'Bald'];
export const HAIR_COLORS = ['#16110F', '#3B2A22', '#6B4A2E', '#B9763A', '#D9B36C', '#8C8C8C', '#C2558A', '#4C6A9A'];
export const BEARDS = ['None', 'Stubble', 'Full', 'Mustache', 'Goatee', 'Boxed'];
export const EYES = ['Dots', 'Happy', 'Sleepy', 'Wink'];
export const MOUTHS = ['Smile', 'Grin', 'Calm'];
export const GLASSES = ['None', 'Rectangle', 'Round', 'Bold'];
export const HIJABS = ['None', 'Wrap', 'Classic'];
export const HIJAB_COLORS = ['#BFB5AA', '#2A2D33', '#2F3A56', '#C98E99', '#7E9C7A', '#E9DCC8', '#B79CF2', '#8C5A4A'];
export const CAP_COLORS = ['#FFFFFF', '#2A2D33', '#E9E2D4', '#5B3A43', '#2F3A56'];
export const HOODIES = ['Black', 'Accent', 'Gray', 'White'];

export const DEFAULT_CHARACTER: CharacterSpec = {
  skin: 1, hair: 0, hairColor: 0, beard: 0, eyes: 0, mouth: 0, glasses: 0,
  hijab: 0, hijabColor: 0, capColor: 0, hoodie: 0,
};

/** Older saved profiles only had skin/hair/eyes/item. Fill in anything missing and clamp to range. */
export function normalizeSpec(raw: Partial<CharacterSpec> | null | undefined): CharacterSpec {
  const pick = (key: keyof CharacterSpec, n: number) => {
    const v = raw?.[key];
    return typeof v === 'number' && v >= 0 && v < n ? Math.floor(v) : DEFAULT_CHARACTER[key];
  };
  return {
    skin: pick('skin', SKINS.length), hair: pick('hair', HAIRS.length), hairColor: pick('hairColor', HAIR_COLORS.length),
    beard: pick('beard', BEARDS.length), eyes: pick('eyes', EYES.length), mouth: pick('mouth', MOUTHS.length),
    glasses: pick('glasses', GLASSES.length), hijab: pick('hijab', HIJABS.length),
    hijabColor: pick('hijabColor', HIJAB_COLORS.length), capColor: pick('capColor', CAP_COLORS.length),
    hoodie: pick('hoodie', HOODIES.length),
  };
}

export function randomSpec(): CharacterSpec {
  const r = (n: number) => Math.floor(Math.random() * n);
  const hijab = Math.random() < 0.3 ? 1 + r(HIJABS.length - 1) : 0;
  return {
    skin: r(SKINS.length), hair: r(HAIRS.length), hairColor: r(6), beard: hijab ? 0 : r(BEARDS.length),
    eyes: r(EYES.length), mouth: r(MOUTHS.length), glasses: Math.random() < 0.4 ? 1 + r(GLASSES.length - 1) : 0,
    hijab, hijabColor: r(HIJAB_COLORS.length), capColor: r(CAP_COLORS.length), hoodie: 0,
  };
}

export const INK = '#121417';

const E = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;
const C = (cx: number, cy: number, r: number) => E(cx, cy, r, r);

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
function hex(c: number[]): string {
  return '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}
function scale(color: string, f: number): string {
  const c = rgb(color);
  return hex(f > 1 ? c.map((v) => v + (255 - v) * (f - 1) * 1.6) : c.map((v) => v * f));
}
function lum(color: string): number {
  const [r, g, b] = rgb(color);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

const p = (d: string, attrs: string) => `<path d="${d}" ${attrs}/>`;
const ink = (w: number) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- body ----------

let logoCache = '';
function logo(fill: string) {
  if (!logoCache) logoCache = LOGO_ART.map(([x, y, d]) => `<path d="${d}" transform="translate(${x},${y})"/>`).join('');
  return `<g transform="translate(112 136) scale(0.0155)" fill="${fill}">${logoCache}</g>`;
}

function hoodie(spec: CharacterSpec, accent: string) {
  const fill = [ '#24272C', accent, '#8A9099', '#ECEEEF' ][spec.hoodie] ?? '#24272C';
  const light = spec.hoodie === 3 || (spec.hoodie === 1 && !accent.startsWith('var(') && lum(accent) > 150);
  const string = light ? '#5B6068' : '#C9CDD2';
  return [
    p('M20 160 C22 124 44 108 80 108 C116 108 138 124 140 160 Z', `fill="${fill}" ${ink(4.5)}`),
    p('M62 110 C66 120 94 120 98 110', `fill="none" ${ink(3.5)}`),
    p('M71 124 L70 146 M89 124 L90 146', `fill="none" stroke="${string}" stroke-width="2.6" stroke-linecap="round"`),
    `<circle cx="70" cy="147.5" r="1.8" fill="${string}"/><circle cx="90" cy="147.5" r="1.8" fill="${string}"/>`,
    logo(light ? INK : '#F4F5F2'),
  ].join('');
}

// ---------- head ----------

const HEAD = 'M80 30 C100 30 113 44 113 66 C113 88 99 104 80 104 C61 104 47 88 47 66 C47 44 60 30 80 30 Z';

function ears(skin: string) {
  return p(`${E(47, 72, 6, 8.5)} ${E(113, 72, 6, 8.5)}`, `fill="${skin}" ${ink(3.5)}`) +
    p('M46 69 C48 71 48 75 46 77 M114 69 C112 71 112 75 114 77', `fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".5"`);
}

function neck(skin: string) {
  return p('M68 96 L68 112 C74 117 86 117 92 112 L92 96 Z', `fill="${scale(skin, 0.86)}" ${ink(3.5)}`);
}

// ---------- hair ----------

const HAIR_BACK: Record<number, string> = {
  4: 'M44 66 C42 40 58 24 80 24 C102 24 118 40 116 66 C116 82 118 98 122 112 C112 118 100 116 96 110 L64 110 C60 116 48 118 38 112 C42 98 44 82 44 66 Z',
  5: C(80, 22, 11),
  6: 'M42 68 C40 40 58 24 80 24 C102 24 120 40 118 68 C120 84 118 96 112 102 C108 94 106 86 104 80 L56 80 C54 86 52 94 48 102 C42 96 40 84 42 68 Z',
};

const HAIR_FRONT: Record<number, { d: string; hi?: string }> = {
  0: {
    d: 'M46 62 C44 48 50 34 62 28 C66 22 74 20 80 22 C86 19 95 21 99 26 C110 30 117 44 114 62 C112 54 110 49 106 46 C104 48 101 48 99 46 C96 48 92 48 90 45 C86 47 81 47 79 44 C75 47 70 47 68 44 C65 47 61 47 59 45 C56 47 53 49 51 52 C49 55 47 58 46 62 Z',
    hi: 'M62 34 C64 31 67 31 69 33 M74 28 C76 25 80 25 82 28 M88 30 C90 27 94 28 95 31 M100 36 C103 35 105 37 105 40 M56 41 C57 38 60 37 62 39 M80 36 C82 34 85 34 86 37',
  },
  1: {
    d: 'M47 60 C46 42 60 29 80 29 C100 29 114 42 113 60 C110 52 104 46 96 44.5 C88 43 72 43 64 44.5 C56 46 50 52 47 60 Z',
    hi: 'M60 36 L61 37 M68 33 L69 34 M78 32 L79 33 M88 33 L89 34 M97 35 L98 36 M64 40 L65 41 M74 37 L75 38 M84 37 L85 38 M94 39 L95 40 M104 41 L105 42',
  },
  2: {
    d: 'M46 64 C42 42 58 25 80 25 C104 25 118 40 114 64 C112 56 108 50 102 47 C92 50 76 49 64 43 C58 48 50 55 46 64 Z',
    hi: 'M66 40 C72 34 82 30 94 30 M60 46 C64 40 70 36 76 34',
  },
  3: {
    d: 'M44 70 C36 66 36 56 42 51 C38 43 44 33 53 34 C55 24 66 18 75 22 C81 14 94 16 98 22 C108 18 120 26 118 36 C126 40 126 52 120 56 C124 62 122 70 116 72 C114 60 110 52 104 48 C96 52 86 50 80 46 C72 52 62 52 56 48 C50 54 46 62 44 70 Z',
    hi: 'M52 42 C53 39 56 38 58 40 M64 30 C66 27 70 27 71 30 M82 25 C84 22 88 22 89 25 M98 30 C100 28 104 29 104 32 M110 42 C112 40 115 41 115 44 M72 38 C73 36 76 36 77 38 M90 38 C91 36 94 36 95 38',
  },
  4: {
    d: 'M46 70 C44 44 60 28 80 28 C100 28 116 44 114 70 C110 56 104 46 92 40 C88 46 84 48 80 48 C76 48 72 46 68 40 C56 46 50 56 46 70 Z',
    hi: 'M70 34 C66 38 60 46 56 54 M90 34 C94 38 100 46 104 54',
  },
  5: {
    d: 'M47 62 C46 42 60 28 80 28 C100 28 114 42 113 62 C108 50 98 44 80 43 C62 44 52 50 47 62 Z',
    hi: 'M62 36 C70 32 76 31 80 31 M98 36 C90 32 84 31 80 31 M74 18 C77 15 83 15 86 18',
  },
  6: {
    d: 'M46 66 C44 42 60 28 80 28 C100 28 116 42 114 66 C108 54 100 48 90 46 C84 52 70 54 60 50 C54 54 50 60 46 66 Z',
    hi: 'M62 36 C70 32 82 31 92 33 M100 40 C104 44 106 48 108 52',
  },
};

const HIDES_EARS = new Set([4, 6]);

// ---------- face ----------

function eyes(spec: CharacterSpec, ex: number) {
  const L = 80 - ex, R = 80 + ex, y = 67;
  const line = `fill="none" ${ink(3.2)}`;
  switch (spec.eyes) {
    case 1: return p(`M${L - 4} ${y + 1.5} Q${L} ${y - 4} ${L + 4} ${y + 1.5} M${R - 4} ${y + 1.5} Q${R} ${y - 4} ${R + 4} ${y + 1.5}`, line);
    case 2: return p(`M${L - 4.5} ${y} L${L + 4.5} ${y} M${R - 4.5} ${y} L${R + 4.5} ${y}`, line) +
      p(`${C(L, y + 1.6, 2.2)} ${C(R, y + 1.6, 2.2)}`, `fill="${INK}"`);
    case 3: return p(C(L, y, 3.4), `fill="${INK}"`) + p(`M${R - 4} ${y + 1} Q${R} ${y - 3.5} ${R + 4} ${y + 1}`, line);
    default: return p(`${C(L, y, 3.4)} ${C(R, y, 3.4)}`, `fill="${INK}"`);
  }
}

function brows(color: string, ex: number) {
  const L = 80 - ex, R = 80 + ex;
  return p(`M${L - 8.5} 55 C${L - 4.5} 52 ${L + 2.5} 52 ${L + 8.5} 54 M${R - 8.5} 54 C${R - 2.5} 52 ${R + 4.5} 52 ${R + 8.5} 55`,
    `fill="none" stroke="${color}" stroke-width="4.2" stroke-linecap="round"`);
}

function mouth(spec: CharacterSpec, bearded: boolean) {
  if (spec.mouth === 1) {
    return p('M68 82 C72 80 88 80 92 82 C91 90 86 94 80 94 C74 94 69 90 68 82 Z', `fill="#5A2A2A" ${ink(3)}`) +
      p('M69.5 82.6 C74 81.4 86 81.4 90.5 82.6 C90 85 88.5 86 80 86 C71.5 86 70 85 69.5 82.6 Z', 'fill="#FFFFFF"');
  }
  if (bearded) {
    // a line would vanish into a beard, so draw a small open mouth instead
    return spec.mouth === 2
      ? p('M72 84 C76 86.5 84 86.5 88 84 C86 89 74 89 72 84 Z', `fill="#C9746E" ${ink(2.6)}`)
      : p('M67.5 82 C71 92 89 92 92.5 82 C88 84.5 72 84.5 67.5 82 Z', `fill="#C9746E" ${ink(2.8)}`);
  }
  return spec.mouth === 2
    ? p('M75 84 C78 85.5 82 85.5 85 84', `fill="none" ${ink(3.2)}`)
    : p('M74 82 C78 85.5 82 85.5 86 82', `fill="none" ${ink(3.2)}`);
}

function cheeks(ex: number) {
  return p(`${E(80 - ex - 7, 76.5, 4.2, 2.5)} ${E(80 + ex + 7, 76.5, 4.2, 2.5)}`, 'fill="#E07A6E" opacity=".38"');
}

// ---------- beard ----------

const BEARD_FULL = 'M48 62 C49 72 51 80 55 86 C60 99 69 106 80 106 C91 106 100 99 105 86 C109 80 111 72 112 62 C111 70 109 78 105 84 C101 85 97 83 93 80.5 C90 78.5 86 78 80 78.4 C74 78 70 78.5 67 80.5 C63 83 59 85 55 84 C51 78 49 70 48 62 Z';
const MUSTACHE = 'M67 78.5 C70 74.5 75 74 80 75.8 C85 74 90 74.5 93 78.5 C90 80 85 79.2 80 78.6 C75 79.2 70 80 67 78.5 Z';
// Boxed: short full beard with the skin around the mouth showing, and a mustache that curves down into it
const BOXED_HOLE = 'M71 86 C73 83.5 77 83 80 83 C83 83 87 83.5 89 86 C89.4 91.5 85.5 95 80 95 C74.5 95 70.6 91.5 71 86 Z';
const BOXED = BEARD_FULL + ' ' + BOXED_HOLE;
const BOXED_MUSTACHE = 'M65 83 C66 77.5 73 75 80 77.4 C87 75 94 77.5 95 83 C94.4 86.5 92.6 88.5 90.6 89.6 C90.4 85.4 87.2 82.2 80 82.4 C72.8 82.2 69.6 85.4 69.4 89.6 C67.4 88.5 65.6 86.5 65 83 Z';
const GOATEE = 'M71 94 C72 101 76 105 80 105 C84 105 88 101 89 94 C85 96.5 75 96.5 71 94 Z';

function beard(spec: CharacterSpec, color: string) {
  const hi = scale(color, 1.9);
  switch (spec.beard) {
    case 1: return p(BEARD_FULL, `fill="${color}" opacity=".32"`);
    case 2: return p(BEARD_FULL, `fill="${color}" ${ink(3.5)}`) +
      p('M60 92 C64 96 68 99 72 100 M100 92 C96 96 92 99 88 100', `fill="none" stroke="${hi}" stroke-width="1.6" stroke-linecap="round" opacity=".7"`);
    case 3: return p(MUSTACHE, `fill="${color}" ${ink(2.6)}`);
    case 4: return p(MUSTACHE, `fill="${color}" ${ink(2.6)}`) + p(GOATEE, `fill="${color}" ${ink(2.6)}`);
    case 5: return p(BOXED, `fill="${color}" fill-rule="evenodd"`) +
      p(BEARD_FULL, `fill="none" ${ink(3.5)}`) +
      p(BOXED_HOLE, `fill="none" stroke="${scale(color, 0.6)}" stroke-width="1.6"`) +
      p('M58 90 C62 95 66 99 71 101 M102 90 C98 95 94 99 89 101', `fill="none" stroke="${hi}" stroke-width="1.6" stroke-linecap="round" opacity=".7"`);
    default: return '';
  }
}

// ---------- glasses ----------

function glasses(spec: CharacterSpec, ex: number, hijab: boolean) {
  if (!spec.glasses) return '';
  const L = 80 - ex, R = 80 + ex;
  const frame = spec.glasses === 3 ? INK : '#7A7F86';
  const w = spec.glasses === 3 ? 3.6 : 2.6;
  const lens = 'fill="#FFFFFF" fill-opacity=".14"';
  const half = hijab ? 8.5 : 11.5;
  const temples = hijab ? '' : ` M${L - half} 62 L48 61 M${R + half} 62 L112 61`;
  const bridge = `M${L + half} 63 C${L + half + 1.5} 61.5 ${R - half - 1.5} 61.5 ${R - half} 63${temples}`;
  const shapes = spec.glasses === 2
    ? `<circle cx="${L}" cy="66.5" r="${half - 1}" ${lens} stroke="${frame}" stroke-width="${w}"/><circle cx="${R}" cy="66.5" r="${half - 1}" ${lens} stroke="${frame}" stroke-width="${w}"/>`
    : `<rect x="${L - half}" y="58.5" width="${half * 2}" height="16" rx="5" ${lens} stroke="${frame}" stroke-width="${w}"/><rect x="${R - half}" y="58.5" width="${half * 2}" height="16" rx="5" ${lens} stroke="${frame}" stroke-width="${w}"/>`;
  return shapes + p(bridge, `fill="none" stroke="${frame}" stroke-width="${w}" stroke-linecap="round"`);
}

// ---------- hijab ----------

function hijab(spec: CharacterSpec) {
  const art = HIJAB_ART[spec.hijab - 1];
  if (!art) return '';
  const color = HIJAB_COLORS[spec.hijabColor] ?? HIJAB_COLORS[0];
  const cap = CAP_COLORS[spec.capColor] ?? CAP_COLORS[0];
  const paths = art.paths.map(([kind, shade, x, y, d]) => {
    const fill = kind === 'i' ? INK : kind === 'c' ? cap : scale(color, shade);
    return `<path d="${d}" transform="translate(${x},${y})" fill="${fill}" stroke="${fill}" stroke-width="2.5" stroke-linejoin="round"/>`;
  }).join('');
  return `<g transform="translate(${art.tx} ${art.ty}) scale(${art.k})">${paths}</g>`;
}

// ---------- whole character ----------

export function renderCharacter(raw: Partial<CharacterSpec>, accent: string): string {
  const spec = normalizeSpec(raw);
  const skin = SKINS[spec.skin];
  const hairColor = HAIR_COLORS[spec.hairColor];
  const hairHi = scale(hairColor, 1.9);
  const out: string[] = [];

  if (spec.hijab) {
    const ex = 11;
    out.push(hoodie(spec, accent));
    out.push(p(E(80, 68, 35, 35), `fill="${skin}"`));
    out.push(hijab(spec));
    out.push(eyes(spec, ex), cheeks(ex), mouth(spec, false), glasses(spec, ex, true));
    return out.join('');
  }

  const ex = 14.5;
  const back = HAIR_BACK[spec.hair];
  if (back) out.push(p(back, `fill="${hairColor}" ${ink(4.5)}`));
  out.push(hoodie(spec, accent), neck(skin));
  if (!HIDES_EARS.has(spec.hair)) out.push(ears(skin));
  out.push(p(HEAD, `fill="${skin}" ${ink(4.5)}`));
  out.push(beard(spec, hairColor));
  // with a boxed beard the mouth sits in the gap under the mustache
  out.push(spec.beard === 5 ? `<g transform="translate(0 4)">${mouth(spec, false)}</g>` : mouth(spec, spec.beard >= 2));
  if (spec.beard === 5) out.push(p(BOXED_MUSTACHE, `fill="${hairColor}" ${ink(3)}`));
  const front = HAIR_FRONT[spec.hair];
  if (front) {
    out.push(p(front.d, `fill="${hairColor}" ${ink(4.5)}`));
    if (front.hi) out.push(p(front.hi, `fill="none" stroke="${hairHi}" stroke-width="2" stroke-linecap="round"`));
  } else {
    out.push(p('M62 40 C66 36 72 34 76 34', 'fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".35"'));
  }
  out.push(brows(spec.hair === 7 ? scale(skin, 0.55) : hairColor, ex));
  out.push(eyes(spec, ex), cheeks(ex), glasses(spec, ex, false));
  return out.join('');
}

export const VIEWBOX = { full: '0 0 160 160', head: '26 6 108 108' } as const;
