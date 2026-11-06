import { useMemo } from 'react';
import type { CharacterSpec } from '../api';
import { renderCharacter, VIEWBOX } from './characterSvg';

export {
  BEARDS, CAP_COLORS, DEFAULT_CHARACTER, EYES, GLASSES, HAIRS, HAIR_COLORS, HIJABS, HIJAB_COLORS,
  HOODIES, MOUTHS, SKINS, normalizeSpec, randomSpec,
} from './characterSvg';

interface Props {
  spec?: Partial<CharacterSpec> | null;
  /** used when the hoodie is set to "Accent" */
  accent?: string;
  size?: number | string;
  crop?: 'full' | 'head';
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
