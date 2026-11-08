import { ProfilePicture } from './ProfilePicture';

// The student's photo (or their cat), filling a round badge.
export function Monogram({ first, last, label, picture, seed }: { first: string; last: string; label?: string;picture?:string|null; seed?:string|null }) {
  return (
    <div className="monogram mono" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <ProfilePicture first={first} last={last} picture={picture} seed={seed}/>
    </div>
  );
}
