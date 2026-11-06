import type { CharacterSpec } from '../api';
import { HIJAB_ART, LOGO_ART } from './characterArt';

// A character is a stack of SVG parts on one 160 x 160 canvas.
// renderCharacter() returns the inner markup so it can be used by React and by tests alike.

export type Gender = 'boy' | 'girl';
export const GENDERS: Gender[] = ['boy', 'girl'];

export const SKINS = ['#F6D7BD', '#E8B895', '#C98E66', '#A86E46', '#8A5634', '#5E3A22'];
export const HAIR_COLORS = ['#16110F', '#3B2A22', '#6B4A2E', '#B9763A', '#D9B36C', '#8C8C8C', '#C2558A', '#4C6A9A'];
export const BEARDS = ['None', 'Stubble', 'Full', 'Mustache', 'Goatee'];
export const EYES = ['Dots', 'Happy', 'Sleepy', 'Wink', 'Sparkle', 'Lashes', 'Lashes happy'];
export const BROWS = ['Natural', 'Thick', 'Straight', 'Arched', 'Soft'];
export const MOUTHS = ['Smile', 'Grin', 'Calm', 'Lips', 'Smirk'];
export const GLASSES = ['None', 'Rectangle', 'Round', 'Bold'];
export const HIJABS = ['None', 'Wrap', 'Classic'];
export const HIJAB_COLORS = ['#BFB5AA', '#2A2D33', '#2F3A56', '#C98E99', '#7E9C7A', '#E9DCC8', '#B79CF2', '#8C5A4A'];
export const CAP_COLORS = ['#FFFFFF', '#2A2D33', '#E9E2D4', '#5B3A43', '#2F3A56'];
export const HOODIES = ['Black', 'Accent', 'Gray', 'White'];

// Which face options each gender is offered, in picker order.
export const FACE_OPTIONS: Record<Gender, { eyes: number[]; brows: number[]; mouth: number[] }> = {
  boy: { eyes: [0, 1, 2, 3, 4], brows: [0, 1, 2], mouth: [0, 1, 2, 4] },
  girl: { eyes: [5, 6, 0, 1, 4, 3], brows: [3, 4, 0], mouth: [0, 3, 1, 2] },
};

// ---------- hair catalog ----------

interface HairStyle {
  name: string;
  for: Gender;
  /** behind the hoodie and head */
  back?: string;
  /** over the shoulders, in front of the hoodie; drawn on the left and mirrored */
  locks?: string;
  /** over the forehead */
  front?: string;
  /** when set, `front` blends into `back` and only this hairline is outlined */
  edge?: string;
  /** see-through hair, like a fade */
  shade?: string;
  /** light strands */
  hi?: string;
  hidesEars?: boolean;
  /** hair tie in the accent color */
  tie?: [number, number];
  braids?: boolean;
}

const SLEEK = 'M47 64 C45 42 60 28 80 28 C100 28 115 42 113 64 C108 52 98 45 80 44 C62 45 52 52 47 64 Z';
const LONG_BACK = 'M42 64 C40 36 58 22 80 22 C102 22 120 36 118 64 L122 120 L38 120 Z';
const LONG_LOCK = 'M44 86 C40 100 35 113 34 125 C33 133 36 139 42 142 C50 138 54 126 55 114 C56 104 54 96 52 90 Z';
const PART = 'M80 31 L80 36 M70 32 C63 36 57 43 54 52 M90 32 C97 36 103 43 106 52';

export const HAIRSTYLES: HairStyle[] = [
  // ----- boys -----
  {
    name: 'Textured', for: 'boy',
    front: 'M46 62 C44 48 50 34 62 28 C66 22 74 20 80 22 C86 19 95 21 99 26 C110 30 117 44 114 62 C112 54 110 49 106 46 C104 48 101 48 99 46 C96 48 92 48 90 45 C86 47 81 47 79 44 C75 47 70 47 68 44 C65 47 61 47 59 45 C56 47 53 49 51 52 C49 55 47 58 46 62 Z',
    hi: 'M62 34 C64 31 67 31 69 33 M74 28 C76 25 80 25 82 28 M88 30 C90 27 94 28 95 31 M100 36 C103 35 105 37 105 40 M56 41 C57 38 60 37 62 39 M80 36 C82 34 85 34 86 37',
  },
  {
    name: 'Buzz', for: 'boy',
    front: 'M47 60 C46 42 60 29 80 29 C100 29 114 42 113 60 C110 52 104 46 96 44.5 C88 43 72 43 64 44.5 C56 46 50 52 47 60 Z',
    hi: 'M60 36 L61 37 M68 33 L69 34 M78 32 L79 33 M88 33 L89 34 M97 35 L98 36 M64 40 L65 41 M74 37 L75 38 M84 37 L85 38 M94 39 L95 40 M104 41 L105 42',
  },
  {
    name: 'Side part', for: 'boy',
    front: 'M46 64 C42 42 58 25 80 25 C104 25 118 40 114 64 C112 56 108 50 102 47 C92 50 76 49 64 43 C58 48 50 55 46 64 Z',
    hi: 'M66 40 C72 34 82 30 94 30 M60 46 C64 40 70 36 76 34',
  },
  {
    name: 'Quiff', for: 'boy',
    front: 'M47 60 C46 44 54 33 66 30 C70 22 82 16 96 19 C108 22 112 32 106 38 C112 44 114 52 113 60 C110 52 104 47 96 45 C88 43 72 43 64 45 C56 47 50 52 47 60 Z',
    hi: 'M74 26 C82 21 92 21 100 24 M78 33 C86 29 94 29 100 32',
  },
  {
    name: 'Curtains', for: 'boy',
    front: 'M46 66 C43 42 58 26 80 26 C102 26 117 42 114 66 C111 56 106 50 98 46 C91 44 85 41 80 36 C75 41 69 44 62 46 C54 50 49 56 46 66 Z',
    hi: 'M70 31 C64 35 58 41 54 49 M90 31 C96 35 102 41 106 49',
  },
  {
    name: 'Curly', for: 'boy',
    front: 'M44 70 C36 66 36 56 42 51 C38 43 44 33 53 34 C55 24 66 18 75 22 C81 14 94 16 98 22 C108 18 120 26 118 36 C126 40 126 52 120 56 C124 62 122 70 116 72 C114 60 110 52 104 48 C96 52 86 50 80 46 C72 52 62 52 56 48 C50 54 46 62 44 70 Z',
    hi: 'M52 42 C53 39 56 38 58 40 M64 30 C66 27 70 27 71 30 M82 25 C84 22 88 22 89 25 M98 30 C100 28 104 29 104 32 M110 42 C112 40 115 41 115 44 M72 38 C73 36 76 36 77 38 M90 38 C91 36 94 36 95 38',
  },
  {
    name: 'Curly fade', for: 'boy',
    shade: 'M47 70 C46 60 47 54 50 50 L58 50 C53 55 52 62 52 72 Z M113 70 C114 60 113 54 110 50 L102 50 C107 55 108 62 108 72 Z',
    front: 'M50 54 C47 42 53 31 62 29 C63 22 72 18 78 21 C83 15 93 16 97 22 C105 20 111 28 109 36 C113 40 113 48 110 54 C104 49 98 47 92 48 C86 50 74 50 68 48 C62 47 55 49 50 54 Z',
    hi: 'M60 34 C61 31 64 30 66 32 M74 26 C76 23 80 23 81 26 M90 25 C92 22 96 23 96 26 M101 33 C103 31 106 32 106 35 M82 34 C83 32 86 32 87 34 M66 41 C67 39 70 39 71 41',
  },
  {
    name: 'Afro', for: 'boy',
    back: 'M40 82 C30 78 27 66 33 59 C25 51 29 37 39 34 C39 22 51 13 62 17 C68 7 92 7 98 17 C109 13 121 22 121 34 C131 37 135 51 127 59 C133 66 130 78 120 82 Z',
    front: 'M44 64 C42 40 58 26 80 26 C102 26 118 40 116 64 C110 54 98 49 80 49 C62 49 50 54 44 64 Z',
    edge: 'M46 60 C52 53 63 49 80 49 C97 49 108 53 114 60',
    hi: 'M44 28 C45 25 48 24 50 26 M60 18 C62 15 66 15 67 18 M84 14 C86 11 90 11 91 14 M104 20 C106 18 109 19 110 22 M118 36 C120 34 123 35 123 38 M36 50 C37 47 40 47 41 49 M70 32 C71 30 74 30 75 32 M92 34 C93 32 96 32 97 34',
  },
  { name: 'Bald', for: 'boy' },

  // ----- girls -----
  {
    name: 'Long', for: 'girl', back: LONG_BACK, locks: LONG_LOCK, hidesEars: true, hi: PART,
    front: 'M44 94 C38 60 50 28 80 27 C110 28 122 60 116 94 C112 86 110 72 108 60 C104 52 92 44 80 35 C68 44 56 52 52 60 C50 72 48 86 44 94 Z',
  },
  {
    name: 'Long wavy', for: 'girl', back: LONG_BACK, hidesEars: true, hi: PART,
    locks: 'M46 88 C38 96 44 106 37 116 C31 125 39 133 35 142 C44 146 52 140 51 130 C50 122 57 116 54 106 C52 100 55 94 52 90 Z',
    front: 'M44 94 C40 84 46 76 42 66 C40 44 56 28 80 27 C104 28 120 44 118 66 C114 76 120 84 116 94 C112 86 112 74 108 62 C104 52 92 44 80 35 C68 44 56 52 52 62 C48 74 48 86 44 94 Z',
  },
  {
    name: 'Bangs', for: 'girl', back: LONG_BACK, locks: LONG_LOCK, hidesEars: true,
    front: 'M44 94 C38 60 48 28 80 27 C112 28 122 60 116 94 C113 84 111 70 110 56 C110 52 109 49 108 47 C96 45 64 45 52 47 C51 49 50 52 50 56 C49 70 47 84 44 94 Z',
    hi: 'M62 34 C70 30 82 30 92 32 M64 40 L63 45 M76 39 L76 45 M88 39 L88 45 M98 40 L99 45',
  },
  {
    name: 'Bob', for: 'girl', hidesEars: true,
    back: 'M42 66 C40 38 58 24 80 24 C102 24 120 38 118 66 C120 80 120 92 116 100 L44 100 C40 92 40 80 42 66 Z',
    front: 'M42 98 C36 62 48 28 80 27 C110 28 124 60 118 98 C113 100 108 98 107 93 C109 78 108 64 104 54 C92 52 76 48 66 40 C60 48 55 55 53 64 C51 76 53 88 53 93 C51 98 46 100 42 98 Z',
    hi: 'M66 33 C76 30 88 30 98 34 M106 50 C110 58 112 68 112 78',
  },
  {
    name: 'Ponytail', for: 'girl', front: SLEEK, tie: [103, 33],
    back: 'M96 32 C108 16 128 18 132 36 C136 56 130 80 124 100 C121 110 113 114 108 108 C114 92 118 76 116 60 C114 48 106 38 96 32 Z',
    hi: 'M62 38 C70 33 78 32 86 32 M118 30 C124 40 126 56 124 72',
  },
  {
    name: 'High bun', for: 'girl', front: SLEEK,
    back: 'M66 22 C66 8 94 8 94 22 C94 32 66 32 66 22 Z',
    hi: 'M62 38 C70 33 78 32 86 32 M74 14 C78 11 84 11 88 14',
  },
  {
    name: 'Braids', for: 'girl', braids: true, hi: PART,
    back: 'M44 66 C42 38 58 24 80 24 C102 24 118 38 116 66 L116 88 L44 88 Z',
    front: 'M46 72 C42 44 58 27 80 27 C102 27 118 44 114 72 C111 60 106 52 100 47 C92 44 86 40 80 35 C74 40 68 44 60 47 C54 52 49 60 46 72 Z',
  },
  {
    name: 'Curly long', for: 'girl', hidesEars: true,
    back: 'M36 116 C26 108 28 96 34 90 C24 82 26 68 34 62 C26 52 32 38 44 36 C46 24 58 18 68 22 C74 12 90 12 96 22 C106 18 118 24 118 36 C130 38 136 52 128 62 C136 68 136 82 126 90 C132 96 134 108 124 116 Z',
    locks: 'M46 88 C36 90 32 100 36 108 C28 114 30 126 38 128 C34 136 40 144 48 140 C54 136 56 128 54 122 C60 116 58 106 54 100 C56 94 52 88 46 88 Z',
    front: 'M46 72 C40 62 44 50 52 48 C52 38 62 32 70 34 C74 26 86 26 90 34 C98 32 108 38 108 48 C116 50 120 62 114 72 C110 64 104 58 98 56 C92 58 84 56 80 52 C76 56 68 58 62 56 C56 58 50 64 46 72 Z',
    hi: 'M58 42 C59 39 62 39 63 41 M76 32 C78 29 82 29 83 32 M96 40 C98 38 101 39 101 42 M40 72 C41 69 44 69 45 71 M118 74 C119 71 122 71 123 73',
  },
  {
    name: 'Side swept', for: 'girl', back: LONG_BACK, locks: LONG_LOCK, hidesEars: true,
    front: 'M44 94 C38 60 48 28 80 27 C110 28 122 60 116 94 C112 86 110 72 108 60 C104 50 94 46 84 46 C74 46 64 42 60 36 C56 44 52 52 52 62 C50 74 48 86 44 94 Z',
    hi: 'M60 34 C70 30 84 30 96 34 M66 40 C76 43 90 43 102 46',
  },
];

export const HAIR_FOR: Record<Gender, number[]> = {
  boy: HAIRSTYLES.flatMap((h, i) => (h.for === 'boy' ? [i] : [])),
  girl: HAIRSTYLES.flatMap((h, i) => (h.for === 'girl' ? [i] : [])),
};

// ---------- presets ----------

const preset = (gender: Gender, s: Partial<CharacterSpec>): CharacterSpec => ({
  gender: gender === 'girl' ? 1 : 0, skin: 1, hair: HAIR_FOR[gender][0], hairColor: 0, beard: 0, eyes: 0, brows: 0, mouth: 0,
  glasses: 0, hijab: 0, hijabColor: 0, capColor: 0, hoodie: 0, ...s,
});
const hair = (name: string) => HAIRSTYLES.findIndex((h) => h.name === name);

export const PRESETS: Record<Gender, CharacterSpec[]> = {
  boy: [
    preset('boy', { skin: 1, hair: hair('Textured') }),
    preset('boy', { skin: 3, hair: hair('Curly'), beard: 2, brows: 1, mouth: 1 }),
    preset('boy', { skin: 0, hair: hair('Side part'), hairColor: 2, glasses: 1, eyes: 4 }),
    preset('boy', { skin: 4, hair: hair('Afro'), brows: 1, mouth: 4, beard: 1 }),
    preset('boy', { skin: 2, hair: hair('Curly fade'), hairColor: 1, beard: 4, brows: 2 }),
    preset('boy', { skin: 1, hair: hair('Quiff'), hairColor: 1, eyes: 1, mouth: 1, glasses: 2 }),
  ],
  girl: [
    preset('girl', { skin: 1, hair: hair('Long'), hairColor: 1, eyes: 5, brows: 3, mouth: 3 }),
    preset('girl', { skin: 2, hijab: 1, hijabColor: 2, eyes: 5, brows: 3 }),
    preset('girl', { skin: 4, hair: hair('Curly long'), eyes: 6, brows: 4, mouth: 1 }),
    preset('girl', { skin: 0, hair: hair('Ponytail'), hairColor: 3, eyes: 4, brows: 3, glasses: 2 }),
    preset('girl', { skin: 1, hijab: 2, hijabColor: 3, capColor: 2, eyes: 6, mouth: 3 }),
    preset('girl', { skin: 3, hair: hair('Braids'), eyes: 5, brows: 4, mouth: 1 }),
  ],
};

export const DEFAULT_CHARACTER: CharacterSpec = PRESETS.boy[0];

export function genderOf(spec: Partial<CharacterSpec> | null | undefined): Gender {
  return spec?.gender === 1 ? 'girl' : 'boy';
}

/** Fill in anything missing, clamp to range, and drop parts the gender doesn't have. */
export function normalizeSpec(raw: Partial<CharacterSpec> | null | undefined): CharacterSpec {
  const gender: Gender = raw?.gender === 1 || (raw?.gender === undefined && (raw?.hijab ?? 0) > 0) ? 'girl' : 'boy';
  const base = PRESETS[gender][0];
  const pick = (key: keyof CharacterSpec, n: number) => {
    const v = raw?.[key];
    return typeof v === 'number' && v >= 0 && v < n ? Math.floor(v) : base[key];
  };
  const hairIndex = pick('hair', HAIRSTYLES.length);
  return {
    gender: gender === 'girl' ? 1 : 0,
    skin: pick('skin', SKINS.length),
    hair: HAIRSTYLES[hairIndex].for === gender ? hairIndex : base.hair,
    hairColor: pick('hairColor', HAIR_COLORS.length),
    beard: gender === 'boy' ? pick('beard', BEARDS.length) : 0,
    eyes: pick('eyes', EYES.length), brows: pick('brows', BROWS.length), mouth: pick('mouth', MOUTHS.length),
    glasses: pick('glasses', GLASSES.length),
    hijab: gender === 'girl' ? pick('hijab', HIJABS.length) : 0,
    hijabColor: pick('hijabColor', HIJAB_COLORS.length), capColor: pick('capColor', CAP_COLORS.length),
    hoodie: pick('hoodie', HOODIES.length),
  };
}

export function randomSpec(gender: Gender): CharacterSpec {
  const r = (n: number) => Math.floor(Math.random() * n);
  const any = (list: number[]) => list[r(list.length)];
  const face = FACE_OPTIONS[gender];
  const girl = gender === 'girl';
  return {
    gender: girl ? 1 : 0, skin: r(SKINS.length), hair: any(HAIR_FOR[gender]), hairColor: r(6),
    beard: girl ? 0 : r(BEARDS.length), eyes: any(face.eyes), brows: any(face.brows), mouth: any(face.mouth),
    glasses: Math.random() < 0.3 ? 1 + r(GLASSES.length - 1) : 0,
    hijab: girl && Math.random() < 0.35 ? 1 + r(HIJABS.length - 1) : 0,
    hijabColor: r(HIJAB_COLORS.length), capColor: r(CAP_COLORS.length), hoodie: 0,
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
const MIRROR = 'transform="matrix(-1 0 0 1 160 0)"';
const both = (markup: string) => markup + `<g ${MIRROR}>${markup}</g>`;

// ---------- body ----------

let logoCache = '';
function logo(fill: string) {
  if (!logoCache) logoCache = LOGO_ART.map(([x, y, d]) => `<path d="${d}" transform="translate(${x},${y})"/>`).join('');
  return `<g transform="translate(112 136) scale(0.0155)" fill="${fill}">${logoCache}</g>`;
}

function hoodie(spec: CharacterSpec, accent: string) {
  const fill = ['#24272C', accent, '#8A9099', '#ECEEEF'][spec.hoodie] ?? '#24272C';
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

// Two braids hanging in front of the shoulders, ending in a tie and a small tuft.
function braids(color: string, accent: string) {
  const links = [[46, 90], [44, 101], [42, 112], [41, 123]].map(([x, y]) => p(E(x, y, 7, 7.5), `fill="${color}" ${ink(3.5)}`)).join('');
  const tuft = p('M37 133 C34 141 37 146 41 147 C45 146 48 141 45 133 Z', `fill="${color}" ${ink(3.5)}`);
  const tie = `<rect x="36" y="128" width="10" height="6" rx="3" fill="${accent}" ${ink(2.6)}/>`;
  return both(tuft + links + tie);
}

// ---------- face ----------

function eyes(spec: CharacterSpec, ex: number) {
  const L = 80 - ex, R = 80 + ex, y = 67;
  const line = `fill="none" ${ink(3.2)}`;
  switch (spec.eyes) {
    case 1: return p(`M${L - 4} ${y + 1.5} Q${L} ${y - 4} ${L + 4} ${y + 1.5} M${R - 4} ${y + 1.5} Q${R} ${y - 4} ${R + 4} ${y + 1.5}`, line);
    case 2: return p(`M${L - 4.5} ${y} L${L + 4.5} ${y} M${R - 4.5} ${y} L${R + 4.5} ${y}`, line) +
      p(`${C(L, y + 1.6, 2.2)} ${C(R, y + 1.6, 2.2)}`, `fill="${INK}"`);
    case 3: return p(C(L, y, 3.4), `fill="${INK}"`) + p(`M${R - 4} ${y + 1} Q${R} ${y - 3.5} ${R + 4} ${y + 1}`, line);
    case 4: return p(`${C(L, y, 4.6)} ${C(R, y, 4.6)}`, `fill="${INK}"`) +
      p(`${C(L + 1.5, y - 1.6, 1.5)} ${C(R + 1.5, y - 1.6, 1.5)}`, 'fill="#FFFFFF"');
    case 5: return p(`${C(L, y, 3.4)} ${C(R, y, 3.4)}`, `fill="${INK}"`) + lashes(L, R, y);
    case 6: return p(`M${L - 4} ${y + 1.5} Q${L} ${y - 4} ${L + 4} ${y + 1.5} M${R - 4} ${y + 1.5} Q${R} ${y - 4} ${R + 4} ${y + 1.5}`, line) +
      p(`M${L - 4} ${y + 1.5} L${L - 7} ${y - 0.8} M${R + 4} ${y + 1.5} L${R + 7} ${y - 0.8}`, `fill="none" ${ink(2.6)}`);
    default: return p(`${C(L, y, 3.4)} ${C(R, y, 3.4)}`, `fill="${INK}"`);
  }
}

// A lash line over each eye that flicks up at the outer corner.
function lashes(L: number, R: number, y: number) {
  return p(`M${L + 3} ${y - 4.2} Q${L - 2} ${y - 6} ${L - 5.5} ${y - 2.5} L${L - 7.5} ${y - 4.5} M${R - 3} ${y - 4.2} Q${R + 2} ${y - 6} ${R + 5.5} ${y - 2.5} L${R + 7.5} ${y - 4.5}`,
    `fill="none" ${ink(2.6)}`);
}

function brows(color: string, ex: number, style: number) {
  const L = 80 - ex, R = 80 + ex;
  const stroke = (w: number) => `fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"`;
  switch (style) {
    case 1: return p(`M${L - 9} 55 C${L - 4.5} 51.5 ${L + 2.5} 51.5 ${L + 9} 54 M${R - 9} 54 C${R - 2.5} 51.5 ${R + 4.5} 51.5 ${R + 9} 55`, stroke(6.2));
    case 2: return p(`M${L - 8.5} 53.5 L${L + 8.5} 54.5 M${R - 8.5} 54.5 L${R + 8.5} 53.5`, stroke(4.8));
    case 3: return p(`M${L - 8.5} 55.5 C${L - 4} 49.5 ${L + 3} 49.5 ${L + 8.5} 53.5 M${R - 8.5} 53.5 C${R - 3} 49.5 ${R + 4} 49.5 ${R + 8.5} 55.5`, stroke(3.2));
    case 4: return p(`M${L - 6} 54.5 C${L - 2.5} 52.5 ${L + 2.5} 52.5 ${L + 6} 54 M${R - 6} 54 C${R - 2.5} 52.5 ${R + 2.5} 52.5 ${R + 6} 54.5`, stroke(3.2));
    default: return p(`M${L - 8.5} 55 C${L - 4.5} 52 ${L + 2.5} 52 ${L + 8.5} 54 M${R - 8.5} 54 C${R - 2.5} 52 ${R + 4.5} 52 ${R + 8.5} 55`, stroke(4.2));
  }
}

function mouth(spec: CharacterSpec, bearded: boolean) {
  if (spec.mouth === 1) {
    return p('M68 82 C72 80 88 80 92 82 C91 90 86 94 80 94 C74 94 69 90 68 82 Z', `fill="#5A2A2A" ${ink(3)}`) +
      p('M69.5 82.6 C74 81.4 86 81.4 90.5 82.6 C90 85 88.5 86 80 86 C71.5 86 70 85 69.5 82.6 Z', 'fill="#FFFFFF"');
  }
  if (spec.mouth === 3) {
    return p('M72.5 82.5 C75.5 80.6 78.5 81 80 82.4 C81.5 81 84.5 80.6 87.5 82.5 C85.5 88 74.5 88 72.5 82.5 Z', `fill="#C65F66" ${ink(2.4)}`) +
      p('M73.5 82.8 C77 84.4 83 84.4 86.5 82.8', 'fill="none" stroke="#8E3B42" stroke-width="1.4" stroke-linecap="round"');
  }
  if (spec.mouth === 4) {
    return bearded
      ? p('M72 83.5 C77 88 85 87.5 90 80.5 C85 83 77 84.5 72 83.5 Z', `fill="#C9746E" ${ink(2.6)}`)
      : p('M73 84 C78 85.8 84 84.8 88 80.8', `fill="none" ${ink(3.2)}`);
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
const GOATEE = 'M71 94 C72 101 76 105 80 105 C84 105 88 101 89 94 C85 96.5 75 96.5 71 94 Z';

function beard(spec: CharacterSpec, color: string) {
  const hi = scale(color, 1.9);
  switch (spec.beard) {
    case 1: return p(BEARD_FULL, `fill="${color}" opacity=".32"`);
    case 2: return p(BEARD_FULL, `fill="${color}" ${ink(3.5)}`) +
      p('M60 92 C64 96 68 99 72 100 M100 92 C96 96 92 99 88 100', `fill="none" stroke="${hi}" stroke-width="1.6" stroke-linecap="round" opacity=".7"`);
    case 3: return p(MUSTACHE, `fill="${color}" ${ink(2.6)}`);
    case 4: return p(MUSTACHE, `fill="${color}" ${ink(2.6)}`) + p(GOATEE, `fill="${color}" ${ink(2.6)}`);
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
  const style = HAIRSTYLES[spec.hair];
  if (style.back) out.push(p(style.back, `fill="${hairColor}" ${ink(4.5)}`));
  out.push(hoodie(spec, accent));
  if (style.locks) {
    // a light strand keeps dark hair readable against a dark hoodie
    const strand = p('M46 100 C43 110 41 120 40 130', `fill="none" stroke="${scale(hairColor, 1.9)}" stroke-width="2" stroke-linecap="round"`);
    out.push(both(p(style.locks, `fill="${hairColor}" ${ink(4.5)}`) + strand));
  }
  if (style.braids) out.push(braids(hairColor, accent));
  out.push(neck(skin));
  if (!style.hidesEars) out.push(ears(skin));
  out.push(p(HEAD, `fill="${skin}" ${ink(4.5)}`));
  out.push(beard(spec, hairColor));
  out.push(mouth(spec, spec.beard >= 2));
  if (style.front) {
    if (style.shade) out.push(p(style.shade, `fill="${hairColor}" opacity=".45"`));
    if (style.edge) {
      // blends into the hair behind, so only the hairline gets an outline
      out.push(p(style.front, `fill="${hairColor}"`), p(style.edge, `fill="none" ${ink(4.5)}`));
    } else {
      out.push(p(style.front, `fill="${hairColor}" ${ink(4.5)}`));
    }
    if (style.tie) {
      const [x, y] = style.tie;
      out.push(`<rect x="${x - 3.5}" y="${y - 5.5}" width="7" height="11" rx="3" fill="${accent}" ${ink(2.6)} transform="rotate(-35 ${x} ${y})"/>`);
    }
    if (style.hi) out.push(p(style.hi, `fill="none" stroke="${scale(hairColor, 1.9)}" stroke-width="2" stroke-linecap="round"`));
  } else {
    out.push(p('M62 40 C66 36 72 34 76 34', 'fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".35"'));
  }
  out.push(brows(style.front ? hairColor : scale(skin, 0.55), ex, spec.brows));
  out.push(eyes(spec, ex), cheeks(ex), glasses(spec, ex, false));
  return out.join('');
}

export const VIEWBOX = { full: '0 0 160 160', head: '26 6 108 108', face: '44 42 72 72' } as const;
