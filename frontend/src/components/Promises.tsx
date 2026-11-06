import { Icon } from './bits';

// The three things that make Fairly fair, in one short list. Takes its colors from the panel it sits on.
export function Promises({ className = '' }: { className?: string }) {
  return (
    <ul className={`promises ${className}`}>
      <li>
        <span className="promises__icon"><Icon name="lock" size={20} /></span>
        <span><b>Anonymous.</b> Students never see who rated them.</span>
      </li>
      <li>
        <span className="promises__icon"><Icon name="eye" size={20} /></span>
        <span><b>Only yours.</b> You see your own rating and nothing else.</span>
      </li>
      <li>
        <span className="promises__icon"><Icon name="scale" size={20} /></span>
        <span><b>Fair by design.</b> If too few people rate you in a window, your rating stays put.</span>
      </li>
    </ul>
  );
}
