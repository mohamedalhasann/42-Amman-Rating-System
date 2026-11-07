import { Icon } from './bits';

// What students can count on, in one short list. Takes its colors from the panel it sits on.
export function Promises({ className = '' }: { className?: string }) {
  return (
    <ul className={`promises ${className}`}>
      <li>
        <span className="promises__icon"><Icon name="lock" size={20} /></span>
        <span>Your ratings are anonymous to other students.</span>
      </li>
      <li>
        <span className="promises__icon"><Icon name="eye" size={20} /></span>
        <span>Your rating is private. Only you can see it.</span>
      </li>
      <li>
        <span className="promises__icon"><Icon name="scale" size={20} /></span>
        <span>Suspicious voting patterns are flagged for review.</span>
      </li>
    </ul>
  );
}
