import logoUrl from '../assets/logo-42-amman.svg';

// The 42 Amman mark. Drawn through a CSS mask so it takes the current text color.
export function CampusLogo({ height = 40, className = '' }: { height?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="42 Amman"
      className={`campus-logo ${className}`}
      style={{ height, width: Math.round((height * 1308) / 1016), ['--logo' as string]: `url(${logoUrl})` }}
    />
  );
}
