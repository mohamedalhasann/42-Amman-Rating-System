import { initials } from './bits';

// The student's initials, filling a round badge. Stands in for a picture or avatar.
export function Monogram({ first, last, label }: { first: string; last: string; label?: string }) {
  return (
    <div className="monogram mono" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <span>{initials(first, last)}</span>
    </div>
  );
}
