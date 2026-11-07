import { ProfilePicture } from './ProfilePicture';

// The student's initials, filling a round badge. Stands in for a picture or avatar.
export function Monogram({ first, last, label, picture }: { first: string; last: string; label?: string;picture?:string|null }) {
  return (
    <div className="monogram mono" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <ProfilePicture first={first} last={last} picture={picture}/>
    </div>
  );
}
