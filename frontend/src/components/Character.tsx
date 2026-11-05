import type { CharacterSpec } from '../api';

// A character is built from swappable SVG parts on one 160x160 canvas.
// The hoodie always wears the student's accent color.

export const SKINS = ['#F6DCC8', '#EBC3A0', '#CD966B', '#9A633F', '#64412A'];
export const HAIRS = ['Swoop', 'Curly', 'Long', 'Buzz', 'Bun'];
export const EYES = ['Dots', 'Happy', 'Calm', 'Wide', 'Wink'];
export const ITEMS = ['None', 'Glasses', 'Headphones', 'Beanie'];

export const DEFAULT_CHARACTER: CharacterSpec = { skin: 0, hair: 0, eyes: 0, item: 0 };

const INK = '#121417';

function HairBack({ hair }: { hair: number }) {
  if (hair === 2)
    return (
      <path
        d="M42 64 C36 30 60 20 80 20 C100 20 124 30 118 64 L124 116 C112 121 102 116 100 106 L60 106 C58 116 48 121 36 116 Z"
        fill={INK}
      />
    );
  if (hair === 4) return <circle cx="80" cy="22" r="13" fill={INK} />;
  return null;
}

function HairFront({ hair }: { hair: number }) {
  switch (hair) {
    case 1:
      return (
        <g fill={INK}>
          <ellipse cx="80" cy="42" rx="33" ry="14" />
          <circle cx="50" cy="52" r="11" />
          <circle cx="58" cy="38" r="13" />
          <circle cx="74" cy="31" r="14" />
          <circle cx="91" cy="33" r="13" />
          <circle cx="104" cy="42" r="12" />
          <circle cx="111" cy="54" r="9" />
        </g>
      );
    case 2:
      return <path d="M45 62 C42 36 62 26 80 26 C98 26 118 36 115 62 C105 50 93 45 80 47 C67 45 55 50 45 62 Z" fill={INK} />;
    case 3:
      return <path d="M47 58 C47 38 62 30 80 30 C98 30 113 38 113 58 C104 47 93 42 80 42 C67 42 56 47 47 58 Z" fill="#3a3f46" />;
    case 4:
      return <path d="M46 60 C45 38 62 30 80 30 C98 30 115 38 114 60 C106 49 94 44 80 45 C66 44 54 49 46 60 Z" fill={INK} />;
    default:
      return (
        <path
          d="M44 64 C40 34 60 22 80 24 C104 22 122 36 116 64 C110 52 100 46 92 48 C86 40 72 40 66 48 C58 44 48 52 44 64 Z"
          fill={INK}
        />
      );
  }
}

function Eyes({ eyes }: { eyes: number }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 3.5, strokeLinecap: 'round' as const };
  switch (eyes) {
    case 1:
      return (
        <g {...line}>
          <path d="M63 71 Q68 64 73 71" />
          <path d="M87 71 Q92 64 97 71" />
        </g>
      );
    case 2:
      return (
        <g {...line}>
          <path d="M63 70 Q68 73 73 70" />
          <path d="M87 70 Q92 73 97 70" />
        </g>
      );
    case 3:
      return (
        <g>
          <circle cx="68" cy="69" r="6.5" fill="#fff" stroke={INK} strokeWidth="3" />
          <circle cx="92" cy="69" r="6.5" fill="#fff" stroke={INK} strokeWidth="3" />
          <circle cx="69" cy="70" r="2.8" fill={INK} />
          <circle cx="93" cy="70" r="2.8" fill={INK} />
        </g>
      );
    case 4:
      return (
        <g>
          <circle cx="68" cy="70" r="3.6" fill={INK} />
          <path d="M87 71 Q92 64 97 71" {...line} />
        </g>
      );
    default:
      return (
        <g fill={INK}>
          <circle cx="68" cy="70" r="3.6" />
          <circle cx="92" cy="70" r="3.6" />
        </g>
      );
  }
}

function Item({ item, accent }: { item: number; accent: string }) {
  switch (item) {
    case 1:
      return (
        <g fill="rgba(255,255,255,0.25)" stroke={INK} strokeWidth="3.5" strokeLinecap="round">
          <circle cx="68" cy="70" r="9.5" />
          <circle cx="92" cy="70" r="9.5" />
          <path d="M77.5 69 Q80 66 82.5 69" fill="none" />
          <path d="M58.5 68 L47 64" fill="none" />
          <path d="M101.5 68 L113 64" fill="none" />
        </g>
      );
    case 2:
      return (
        <g>
          <path d="M44 66 C40 26 120 26 116 66" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
          <rect x="36" y="56" width="14" height="24" rx="6" fill={accent} stroke={INK} strokeWidth="3.5" />
          <rect x="110" y="56" width="14" height="24" rx="6" fill={accent} stroke={INK} strokeWidth="3.5" />
        </g>
      );
    case 3:
      return (
        <g stroke={INK} strokeWidth="3.5" strokeLinejoin="round">
          <path d="M44 56 C44 28 62 20 80 20 C98 20 116 28 116 56 Z" fill={INK} />
          <rect x="41" y="50" width="78" height="12" rx="5" fill={accent} />
          <circle cx="80" cy="16" r="6.5" fill={accent} />
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
  const viewBox = crop === 'head' ? '28 8 104 104' : '0 0 160 160';
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
      <path
        d="M22 160 C24 122 44 104 80 104 C116 104 136 122 138 160 Z"
        fill={accent}
        stroke={INK}
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M58 108 C62 122 98 122 102 108" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <path d="M71 118 L69 136 M89 118 L91 136" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <text x="80" y="153" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight={700} fontSize="15" fill={INK}>
        42
      </text>
      <path d="M68 96 L68 110 C72 116 88 116 92 110 L92 96 Z" fill={skin} stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <ellipse cx="80" cy="66" rx="34" ry="36" fill={skin} stroke={INK} strokeWidth="5" />
      <HairFront hair={spec.hair} />
      <ellipse cx="59" cy="81" rx="5" ry="3" fill="#F28B82" opacity="0.4" />
      <ellipse cx="101" cy="81" rx="5" ry="3" fill="#F28B82" opacity="0.4" />
      <Eyes eyes={spec.eyes} />
      <path d="M74 84 C78 87.5 82 87.5 86 84" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <Item item={spec.item} accent={accent} />
    </svg>
  );
}
