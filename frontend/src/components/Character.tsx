import type { CharacterSpec } from '../api';

// A character is built from swappable SVG parts on one canvas (viewBox -10 0 220 220).
// Doodle style: thick rounded ink lines, head turned slightly, dot eyes.
// The hoodie always wears the student's accent color.

export const SKINS = ['#F6DCC8', '#EBC3A0', '#CD966B', '#9A633F', '#64412A'];
export const HAIRS = ['Curly', 'Bob', 'Swoop', 'Buzz', 'Bun'];
export const EYES = ['Dots', 'Happy', 'Sleepy', 'Wide', 'Smile'];
export const ITEMS = ['None', 'Glasses', 'Headphones', 'Beanie'];

export const DEFAULT_CHARACTER: CharacterSpec = { skin: 0, hair: 0, eyes: 0, item: 0 };

const INK = '#121417';
const LINE = { stroke: INK, strokeWidth: 7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const HEAD = 'M66 84 C64 56 84 38 108 38 C134 38 150 58 148 86 C146 112 128 130 104 130 C90 130 78 124 72 114 C68 108 66 98 66 84 Z';

function HairBack({ hair }: { hair: number }) {
  if (hair === 1)
    return <path d="M52 118 C40 80 52 34 106 32 C156 32 166 76 156 120 C150 132 136 132 132 122 L84 122 C78 134 60 132 52 118 Z" fill={INK} />;
  if (hair === 4)
    return <circle cx="150" cy="46" r="17" fill={INK} />;
  return null;
}

function HairFront({ hair }: { hair: number }) {
  switch (hair) {
    case 1:
      return <path d="M64 76 C66 48 90 36 112 38 C136 40 150 56 150 74 C130 70 110 60 100 50 C92 62 80 70 64 76 Z" fill={INK} />;
    case 2:
      return <path d="M63 80 C60 50 86 33 112 35 C136 37 152 54 151 78 C142 67 128 61 114 61 C100 68 82 74 63 80 Z" fill={INK} />;
    case 3:
      return <path d="M66 72 C68 50 88 38 110 38 C132 38 148 52 148 70 C130 60 92 60 66 72 Z" fill="#3a3f46" />;
    case 4:
      return <path d="M64 76 C64 52 86 38 110 38 C134 38 150 54 150 72 C134 66 118 58 108 50 C96 62 82 70 64 76 Z" fill={INK} />;
    default:
      return (
        <path
          d="M60 84 C48 70 56 46 72 42 C74 26 96 18 110 26 C126 16 148 24 150 44 C166 50 166 74 154 86 C160 100 152 116 140 114 C144 98 140 82 132 72 C118 76 98 74 86 62 C78 70 70 78 60 84 Z"
          fill={INK}
        />
      );
  }
}

function Face({ eyes }: { eyes: number }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 5, strokeLinecap: 'round' as const };
  switch (eyes) {
    case 1:
      return <path d="M83 92 Q88 85 93 92 M105 92 Q110 85 115 92" {...line} />;
    case 2:
      return <path d="M83 91 L93 91 M105 91 L115 91" {...line} />;
    case 3:
      return (
        <g>
          <circle cx="88" cy="89" r="8.5" fill="#fff" stroke={INK} strokeWidth="4.5" />
          <circle cx="111" cy="89" r="8.5" fill="#fff" stroke={INK} strokeWidth="4.5" />
          <circle cx="86" cy="90" r="3.6" fill={INK} />
          <circle cx="109" cy="90" r="3.6" fill={INK} />
        </g>
      );
    case 4:
      return (
        <g>
          <circle cx="88" cy="90" r="4.8" fill={INK} />
          <circle cx="110" cy="90" r="4.8" fill={INK} />
          <path d="M91 108 Q98 114 105 108" {...line} />
        </g>
      );
    default:
      return (
        <g fill={INK}>
          <circle cx="88" cy="90" r="4.8" />
          <circle cx="110" cy="90" r="4.8" />
        </g>
      );
  }
}

function Item({ item, accent }: { item: number; accent: string }) {
  switch (item) {
    case 1:
      return (
        <g fill="rgba(255,255,255,0.3)" stroke={INK} strokeWidth="5" strokeLinecap="round">
          <circle cx="88" cy="90" r="11.5" />
          <circle cx="114" cy="90" r="11.5" />
          <path d="M99.5 89 L102.5 89" fill="none" />
          <path d="M125.5 87 L146 82" fill="none" />
        </g>
      );
    case 2:
      return (
        <g>
          <path d="M64 88 C56 26 154 22 150 86" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
          <rect x="52" y="74" width="20" height="30" rx="9" fill={accent} stroke={INK} strokeWidth="6" />
          <rect x="140" y="72" width="20" height="30" rx="9" fill={accent} stroke={INK} strokeWidth="6" />
        </g>
      );
    case 3:
      return (
        <g stroke={INK} strokeWidth="6" strokeLinejoin="round">
          <path d="M60 70 C60 36 84 20 108 20 C136 20 156 38 154 70 Z" fill={INK} />
          <rect x="56" y="62" width="102" height="18" rx="8" fill={accent} />
          <circle cx="108" cy="15" r="9" fill={accent} />
        </g>
      );
    default:
      return null;
  }
}

interface Props {
  spec?: CharacterSpec;
  accent?: string;
  size?: number | string;
  crop?: 'full' | 'head';
  className?: string;
  label?: string;
}

export function Character({
  spec = DEFAULT_CHARACTER,
  accent = 'var(--accent)',
  size = 160,
  crop = 'full',
  className,
  label,
}: Props) {
  const skin = SKINS[spec.skin] ?? SKINS[0];
  const viewBox = crop === 'head' ? '36 4 144 144' : '-10 0 220 220';
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <HairBack hair={spec.hair} />
      <path d="M44 222 C44 176 66 152 108 150 C150 152 172 176 172 222 Z" fill={accent} {...LINE} />
      <path d="M80 157 C88 173 128 173 136 157" fill="none" {...LINE} />
      <path d="M100 168 L98 194 M118 168 L120 194 M66 198 L62 222 M150 198 L154 222" fill="none" {...LINE} strokeWidth={6} />
      <path d="M98 126 L98 150 M120 122 L120 150" fill="none" {...LINE} />
      <text x="108" y="213" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight={700} fontSize="15" fill={INK}>
        42
      </text>
      <path d={HEAD} fill={skin} {...LINE} />
      <HairFront hair={spec.hair} />
      <Face eyes={spec.eyes} />
      <Item item={spec.item} accent={accent} />
    </svg>
  );
}
