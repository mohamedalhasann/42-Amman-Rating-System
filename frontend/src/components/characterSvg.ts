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
  // Short styles come down into a sideburn in front of each ear (x 47-53, to y 68).
  {
    name: 'Crop', for: 'boy',
    front: 'M47 68 C44 54 46 42 53 34 C60 25 70 21 80 21 C91 21 101 25 107 33 C114 42 116 54 113 68 L108 68 C108 61 107 55 105 50 Q101 44 98 43 Q97 48 93 51 Q90 45 86 43 Q85 48 81 51 Q78 45 74 43 Q73 48 69 51 Q66 45 62 44 Q61 49 57 51 Q55 51 55 50 C53 55 52 61 52 68 Z',
    hi: 'M60 34 C66 30 72 28 78 28 M86 28 C92 29 98 31 103 36',
  },
  {
    name: 'Buzz', for: 'boy',
    shade: 'M49 66 C48 45 61 32 80 32 C99 32 112 45 111 66 L108 66 C107 57 105 52 101 48.5 C93 45.5 67 45.5 59 48.5 C55 52 53 57 52 66 Z',
  },
  {
    name: 'Side part', for: 'boy',
    front: 'M47 68 C44 52 48 38 58 30 C66 24 74 22 82 22 C96 22 108 30 112 42 C115 50 115 60 113 68 L108 68 C108 61 107 55 104 50 C96 50 84 47 75 42 C71 40 68 38 66 35 C62 39 58 44 56 49 C53 55 52 61 52 68 Z',
    hi: 'M66 35 L61 28 M70 33 C80 29 94 30 105 39 M73 39 C82 42 92 44 101 46',
  },
  {
    name: 'Quiff', for: 'boy',
    front: 'M47 68 C44 54 46 42 52 36 C54 28 60 23 66 21 C68 15 76 12 86 13 C97 14 106 19 106 25 C112 31 115 45 113 68 L108 68 C108 61 107 55 104 50 C96 47 88 46 80 47 C72 46 63 47 56 50 C53 55 52 61 52 68 Z',
    hi: 'M64 37 C64 28 72 21 84 19 M76 41 C78 32 88 26 99 26 M92 42 C96 36 102 32 108 34',
  },
  {
    name: 'Slick back', for: 'boy',
    front: 'M47 66 C44 50 50 34 62 27 C68 23 74 21 80 21 C86 21 92 23 98 27 C110 34 116 50 113 66 L108 66 C108 58 106 50 102 45 C96 41 88 39 80 40 C72 39 64 41 58 45 C54 50 52 58 52 66 Z',
    hi: 'M67 41 C65 34 67 29 71 26 M80 39 C79 33 80 28 82 25 M93 41 C95 34 93 29 89 26',
  },
  {
    name: 'Curly', for: 'boy',
    front: 'M46 70 C38 66 38 56 43 51 C38 43 44 33 53 34 C55 24 66 18 75 22 C81 14 94 16 98 22 C108 18 120 26 117 36 C124 41 124 52 118 56 C121 62 120 68 114 70 C113 62 110 55 105 51 C99 54 91 53 86 49 C80 54 70 54 65 50 C60 54 54 54 52 52 C49 57 47 63 46 70 Z',
    hi: 'M50 44 a3.5 3.5 0 1 1 5 3 M64 30 a3.5 3.5 0 1 1 5 3 M82 24 a3.5 3.5 0 1 1 5 3 M100 30 a3.5 3.5 0 1 1 5 3 M108 45 a3.5 3.5 0 1 1 5 3 M72 40 a3.5 3.5 0 1 1 5 3 M90 38 a3.5 3.5 0 1 1 5 3',
  },
  {
    name: 'Curly top', for: 'boy',
    shade: 'M48 68 C46 58 47 50 51 44 L57 46 C54 53 53 60 52 68 Z M112 68 C114 58 113 50 109 44 L103 46 C106 53 107 60 108 68 Z',
    front: 'M52 50 C47 42 51 32 60 31 C61 22 71 17 78 21 C83 13 95 15 98 22 C106 19 114 27 111 35 C116 40 115 48 108 51 C103 47 98 46 93 49 C88 46 82 46 77 49 C72 46 66 46 62 49 C59 47 55 47 52 50 Z',
    hi: 'M58 37 a3.5 3.5 0 1 1 5 3 M72 27 a3.5 3.5 0 1 1 5 3 M88 25 a3.5 3.5 0 1 1 5 3 M100 33 a3.5 3.5 0 1 1 5 3 M80 37 a3.5 3.5 0 1 1 5 3',
  },
  {
    name: 'Afro', for: 'boy',
    back: 'M40 82 C30 78 27 66 33 59 C25 51 29 37 39 34 C39 22 51 13 62 17 C68 7 92 7 98 17 C109 13 121 22 121 34 C131 37 135 51 127 59 C133 66 130 78 120 82 Z',
    front: 'M44 64 C42 40 58 26 80 26 C102 26 118 40 116 64 C110 54 98 49 80 49 C62 49 50 54 44 64 Z',
    edge: 'M46 60 C52 53 63 49 80 49 C97 49 108 53 114 60',
    hi: 'M42 30 a3.5 3.5 0 1 1 5 3 M60 18 a3.5 3.5 0 1 1 5 3 M84 14 a3.5 3.5 0 1 1 5 3 M104 22 a3.5 3.5 0 1 1 5 3 M118 40 a3.5 3.5 0 1 1 5 3 M34 52 a3.5 3.5 0 1 1 5 3 M70 32 a3.5 3.5 0 1 1 5 3 M92 34 a3.5 3.5 0 1 1 5 3',
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
  // ----- more boys, kept at the end so saved indices don't move -----
  {
    name: 'Fade', for: 'boy',
    shade: 'M48 68 C46 55 47 44 53 37 L62 42 C57 49 54 58 53 68 Z M112 68 C114 55 113 44 107 37 L98 42 C103 49 106 58 107 68 Z',
    front: 'M53 46 C50 32 63 20 80 20 C97 20 110 32 107 46 Q103 42 99 44 Q96 41 91 43 Q87 40 82 42 Q78 40 73 42 Q68 40 64 43 Q60 41 57 44 Q55 44 53 46 Z',
    hi: 'M63 31 C69 27 76 26 84 26 M90 28 C95 29 100 32 103 36',
  },
  {
    name: 'Spiky', for: 'boy',
    front: 'M47 68 C45 56 46 46 50 40 L43 33 L55 31 L52 20 L65 25 L69 12 L78 22 L88 10 L92 23 L104 14 L104 27 L117 27 L110 40 C114 48 115 58 113 68 L108 68 C108 61 107 55 104 50 C96 47 88 46 80 46 C72 46 64 47 56 50 C53 55 52 61 52 68 Z',
    hi: 'M60 34 L56 26 M72 30 L70 20 M86 28 L88 17 M98 31 L101 22',
  },
  {
    name: 'Man bun', for: 'boy',
    back: 'M68 20 C68 9 92 9 92 20 C92 29 68 29 68 20 Z',
    front: 'M47 68 C44 52 50 36 62 29 C68 26 74 25 80 25 C86 25 92 26 98 29 C110 36 116 52 113 68 L108 68 C108 60 106 52 102 47 C96 44 88 43 80 44 C72 43 64 44 58 47 C54 52 52 60 52 68 Z',
    hi: 'M66 44 C68 37 72 32 76 29 M80 43 L80 28 M94 44 C92 37 88 32 84 29 M74 15 C78 13 84 13 87 15',
  },
];

export const HAIR_FOR: Record<Gender, number[]> = {
  boy: ['Crop', 'Fade', 'Side part', 'Quiff', 'Slick back', 'Spiky', 'Curly', 'Curly top', 'Afro', 'Man bun', 'Buzz', 'Bald']
    .map((name) => HAIRSTYLES.findIndex((h) => h.name === name)),
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
    preset('boy', { skin: 1, hair: hair('Crop') }),
    preset('boy', { skin: 3, hair: hair('Curly'), beard: 2, brows: 1, mouth: 1 }),
    preset('boy', { skin: 0, hair: hair('Side part'), hairColor: 2, glasses: 1, eyes: 4 }),
    preset('boy', { skin: 4, hair: hair('Afro'), brows: 1, mouth: 4, beard: 1 }),
    preset('boy', { skin: 2, hair: hair('Curly top'), hairColor: 1, beard: 4, brows: 2 }),
    preset('boy', { skin: 1, hair: hair('Fade'), hairColor: 1, eyes: 1, mouth: 1, glasses: 2 }),
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
  if (style.shade) out.push(p(style.shade, `fill="${hairColor}" opacity=".55"`));
  if (style.front) {
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
  } else if (!style.shade) {
    out.push(p('M62 40 C66 36 72 34 76 34', 'fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".35"'));
  }
  if (style.hi) out.push(p(style.hi, `fill="none" stroke="${scale(hairColor, 1.9)}" stroke-width="2" stroke-linecap="round" opacity=".8"`));
  out.push(brows(style.front || style.shade ? hairColor : scale(skin, 0.55), ex, spec.brows));
  out.push(eyes(spec, ex), cheeks(ex), glasses(spec, ex, false));
  return out.join('');
}

export const VIEWBOX = { full: '0 0 160 160', head: '26 6 108 108', face: '44 42 72 72' } as const;
