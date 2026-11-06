import { useMemo } from 'react';
import type { CharacterSpec } from '../api';
import { renderCharacter, VIEWBOX } from './characterSvg';

export {
  BEARDS, BROWS, CAP_COLORS, DEFAULT_CHARACTER, EYES, FACE_OPTIONS, GLASSES, HAIRSTYLES, HAIR_COLORS, HAIR_FOR, HIJABS,
  HIJAB_COLORS, HOODIES, MOUTHS, PRESETS, SKINS, genderOf, normalizeSpec, randomSpec,
} from './characterSvg';
export type { Gender } from './characterSvg';

interface Props {
  spec?: Partial<CharacterSpec> | null;
  /** used when the hoodie is set to "Accent" */
  accent?: string;
  size?: number | string;
  crop?: 'full' | 'head' | 'face';
  className?: string;
  label?: string;
}

export function Character({ spec, accent = '#00BABC', size = 160, crop = 'full', className, label }: Props) {
  const markup = useMemo(() => renderCharacter(spec ?? {}, accent), [spec, accent]);
  return (
    <svg
      width={size}
      height={size}
      viewBox={VIEWBOX[crop]}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
