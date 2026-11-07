import { useEffect, useRef, useState, type CSSProperties } from 'react';
import normalUrl from '../assets/pet/cat-normal.png';
import blinkUrl from '../assets/pet/cat-blink.png';
import happyUrl from '../assets/pet/cat-happy.png';
import sparklesUrl from '../assets/pet/cat-sparkles.png';
import sleepyUrl from '../assets/pet/cat-sleepy.png';
import zzzUrl from '../assets/pet/cat-zzz.png';

export type Mood = 'normal' | 'happy' | 'sleepy';

// Every frame shares one 95 x 91 pixel canvas, so the layers line up exactly.
const W = 95;
const H = 91;

const LABEL: Record<Mood, string> = {
  normal: 'Your cat, sitting and blinking',
  happy: 'Your cat, happy',
  sleepy: 'Your cat, napping',
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

interface Props {
  mood?: Mood;
  /** Whole pixels per sprite pixel. Keep it an integer so the pixel art stays crisp. */
  scale?: number;
  /** Clicking the cat makes it happy for a moment. */
  pettable?: boolean;
  className?: string;
}

/** The pixel cat. It breathes, blinks, cheers or naps depending on `mood`. */
export function Kitten({ mood = 'normal', scale = 3, pettable = false, className = '' }: Props) {
  const reduced = useReducedMotion();
  const [blink, setBlink] = useState(false);
  const [petted, setPetted] = useState(false);
  const petTimer = useRef<number>();
  const shown: Mood = petted ? 'happy' : mood;

  // Blink every few seconds, at slightly uneven intervals so it doesn't feel mechanical.
  useEffect(() => {
    if (reduced || shown !== 'normal') return;
    let t: number;
    let open: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        open = window.setTimeout(() => {
          setBlink(false);
          loop();
        }, 150);
      }, 2600 + Math.random() * 2800);
    };
    loop();
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(open);
      setBlink(false);
    };
  }, [reduced, shown]);

  useEffect(() => () => window.clearTimeout(petTimer.current), []);

  function pet() {
    setPetted(true);
    window.clearTimeout(petTimer.current);
    petTimer.current = window.setTimeout(() => setPetted(false), 1800);
  }

  const style = { width: W * scale, height: H * scale, ['--px' as string]: `${scale}px` } as CSSProperties;
  const body =
    shown === 'happy' ? happyUrl : shown === 'sleepy' ? sleepyUrl : blink ? blinkUrl : normalUrl;

  const layers = (
    <span className={`kitten__body kitten__body--${shown}`} key={shown}>
      <img src={body} alt="" draggable={false} />
      {shown === 'happy' && <img className="kitten__sparkles" src={sparklesUrl} alt="" draggable={false} />}
      {shown === 'sleepy' && <img className="kitten__zzz" src={zzzUrl} alt="" draggable={false} />}
    </span>
  );

  const cls = `kitten ${reduced ? 'kitten--still' : ''} ${className}`;
  return pettable ? (
    <button type="button" className={`${cls} kitten--pettable`} style={style} onClick={pet} aria-label="Pet the cat">
      {layers}
    </button>
  ) : (
    <span className={cls} style={style} role="img" aria-label={LABEL[shown]}>
      {layers}
    </span>
  );
}
