import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, StarIcon, initials, starWord } from '../components/bits';
import { ApiError, api, type Label, type Peer, type Stars, type SubmitRatingResult, type VotingWindow } from '../api';

interface Props {
  votingWindow: VotingWindow;
  ratedIds: string[];
  onClose(): void;
  onSubmitted(result: SubmitRatingResult): void;
}

const CAPTION: Record<Stars, string> = { 3: 'Positive', 2: 'Mixed', 1: 'Serious' };
const HINT: Record<Stars, string> = {
  3: 'What stood out? Optional.',
  2: 'What was mixed? Optional.',
  1: 'Why? Tick at least one.',
};

function friendly(err: unknown) {
  if (!(err instanceof ApiError)) return 'Something went wrong. Try again.';
  switch (err.code) {
    case 'WINDOW_CLOSED': return 'This voting window just closed.';
    case 'VOTE_LIMIT_REACHED': return 'You’ve used all your votes for this window.';
    case 'ALREADY_RATED': return 'You already rated this student in this window.';
    case 'SELF_VOTE_NOT_ALLOWED': return 'You can’t rate yourself.';
    case 'RECIPIENT_UNAVAILABLE': return 'This student isn’t available to rate.';
    default: return err.message;
  }
}

const TILT: Record<Stars, number> = { 3: -8, 2: 6, 1: -4 };

/** The ink mark left on the ballot when a stamp is chosen. */
function StampMark({ stars }: { stars: Stars }) {
  return (
    <svg className={`mark mark--${stars}`} viewBox="0 0 150 84" style={{ ['--tilt' as string]: `${TILT[stars]}deg` }} aria-hidden="true">
      <g filter="url(#ink-rough)" fill="none" stroke="currentColor">
        <rect x="4" y="4" width="142" height="76" rx="14" strokeWidth="5.5" />
        <rect x="12" y="12" width="126" height="60" rx="9" strokeWidth="2.2" />
      </g>
      <g filter="url(#ink-rough)" fill="currentColor">
        {Array.from({ length: stars }, (_, i) => {
          const x = 75 + (i - (stars - 1) / 2) * 24;
          return <path key={i} transform={`translate(${x - 10} 15) scale(0.84)`} d="M12 1.8l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.1l7.1-.7z" />;
        })}
        <text x="75" y="63" textAnchor="middle" fontSize="19" fontWeight="700" letterSpacing="0.5">{CAPTION[stars]}</text>
      </g>
    </svg>
  );
}

/** A small ballot dropping through the slot of a box. */
function BallotBox({ stars, name }: { stars: Stars; name: string }) {
  return (
    <svg className="box" viewBox="0 0 200 170" role="img" aria-label={`Ballot for ${name} dropped in the box`}>
      <defs>
        <clipPath id="above-slot"><rect x="0" y="-120" width="200" height="212" /></clipPath>
      </defs>
      <g clipPath="url(#above-slot)"><g className="box__slip">
        <rect x="62" y="6" width="76" height="92" rx="6" fill="#fff" stroke="var(--ink)" strokeWidth="3.5" />
        <path d="M74 26 H126 M74 38 H110" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" />
        <g transform="rotate(-8 100 68)">
          <rect x="74" y="54" width="52" height="28" rx="6" fill="none" stroke={stars === 1 ? 'var(--ink)' : 'var(--accent-deep)'} strokeWidth="3" />
          <text x="100" y="73" textAnchor="middle" fontSize="13" fontWeight="700" fill={stars === 1 ? 'var(--ink)' : 'var(--accent-deep)'}>{'★'.repeat(stars)}</text>
        </g>
      </g></g>
      <g className="box__body">
      <path d="M22 96 H178 L166 164 H34 Z" fill="var(--accent)" stroke="var(--ink)" strokeWidth="4" strokeLinejoin="round" />
      <rect x="10" y="84" width="180" height="16" rx="4" fill="var(--paper)" stroke="var(--ink)" strokeWidth="4" />
      <rect x="58" y="89" width="84" height="6" rx="3" fill="var(--ink)" />
      <text x="100" y="138" textAnchor="middle" fontSize="18" fontWeight="700" fill="var(--ink)">Fairly</text>
      </g>
    </svg>
  );
}

export function RateSheet({ votingWindow, ratedIds, onClose, onSubmitted }: Props) {
  const [step, setStep] = useState<'search' | 'form' | 'done'>('search');
  const [query, setQuery] = useState('');
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const [target, setTarget] = useState<Peer | null>(null);
  const [stars, setStars] = useState<Stars | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [explanation, setExplanation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmitRatingResult | null>(null);
  const idempotency = useRef(crypto.randomUUID());
  const panelRef = useRef<HTMLDivElement>(null);
  const labelCache = useRef(new Map<Stars, Label[]>());

  // Close with Escape, keep the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Search with a short debounce.
  useEffect(() => {
    if (step !== 'search') return;
    let cancelled = false;
    const t = setTimeout(() => {
      api.searchPeers(query).then((items) => !cancelled && setPeers(items)).catch(() => !cancelled && setPeers([]));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, step]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [step]);

  async function chooseStars(n: Stars) {
    setStars(n);
    setPicked([]);
    setError('');
    const cached = labelCache.current.get(n);
    if (cached) return setLabels(cached);
    setLabels([]);
    try {
      const items = await api.labels(n);
      labelCache.current.set(n, items);
      setLabels(items);
    } catch {
      setError('Couldn’t load labels. Try again.');
    }
  }

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setError('');
  }

  async function submit() {
    if (!target || !stars) return setError('Stamp the ballot first.');
    if (stars === 1 && picked.length === 0) return setError('Tick at least one reason.');
    if (stars === 1 && !explanation.trim()) return setError('Tell staff what happened.');
    setBusy(true);
    setError('');
    try {
      const res = await api.submitRating(
        {
          window_id: votingWindow.id,
          recipient_id: target.recipient_id,
          stars,
          label_ids: picked,
          ...(explanation.trim() ? { explanation: explanation.trim() } : {}),
        },
        idempotency.current,
      );
      setResult(res);
      setStep('done');
      onSubmitted(res);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  function startAnother() {
    idempotency.current = crypto.randomUUID();
    setTarget(null);
    setStars(null);
    setPicked([]);
    setExplanation('');
    setResult(null);
    setQuery('');
    setStep('search');
  }

  const ballotNo = ratedIds.length + 1;

  const orderedLabels = useMemo(() => {
    const rank = { positive: 0, concern: 1, flag: 2 } as const;
    return [...labels].sort((a, b) => (stars === 1 ? rank[b.tone] - rank[a.tone] : rank[a.tone] - rank[b.tone]));
  }, [labels, stars]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="ink-rough">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.6" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="9" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.75" result="speckle" />
          <feComposite in="rough" in2="speckle" operator="in" />
        </filter>
      </svg>
      <button className="sheet__backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet__panel" ref={panelRef}>
        <div className="sheet__head">
          {step === 'form' ? (
            <button className="icon-btn" aria-label="Back to search" onClick={() => setStep('search')}>
              <Icon name="back" />
            </button>
          ) : (
            <span />
          )}
          <h2 id="sheet-title" className="sheet__title">
            {step === 'search' ? 'Who do you want to rate?' : step === 'form' ? 'Your ballot' : 'In the box'}
          </h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        {step === 'search' && (
          <div className="sheet__body">
            <div className="search">
              <Icon name="search" />
              <input
                data-autofocus
                className="search__input mono"
                placeholder="Name or login"
                aria-label="Search by name or intra username"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <ul className="peers" aria-busy={peers === null}>
              {peers?.length === 0 && <li className="muted peers__empty">No students match “{query}”.</li>}
              {peers?.map((p, i) => {
                const done = ratedIds.includes(p.recipient_id);
                return (
                  <li key={p.recipient_id} style={{ animationDelay: `${i * 30}ms` }} className="rise">
                    <button
                      className="peer"
                      disabled={done}
                      onClick={() => {
                        setTarget(p);
                        setStars(null);
                        setPicked([]);
                        setExplanation('');
                        setError('');
                        setStep('form');
                      }}
                    >
                      <span className="peer__avatar mono" aria-hidden="true">{initials(p.first_name, p.last_name)}</span>
                      <span className="peer__text">
                        <span className="peer__name">{p.first_name} {p.last_name}</span>
                        <span className="mono muted peer__login">{p.intra_username}</span>
                      </span>
                      {done && <span className="peer__tag">Rated</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {step === 'form' && target && (
          <div className="sheet__body">
            <article className={`ballot${stars ? ` ballot--${stars}` : ''}`} aria-label={`Ballot for ${target.first_name} ${target.last_name}`}>
              <header className="ballot__head">
                <span>{votingWindow.name}</span>
                <span>Ballot {ballotNo} of {votingWindow.max_votes}</span>
              </header>
              <div className="ballot__for">
                <span className="ballot__label">For</span>
                <p className="ballot__name">{target.first_name} {target.last_name}</p>
                <p className="mono muted ballot__login">{target.intra_username}</p>
              </div>
              {stars && <StampMark key={stars} stars={stars} />}

              <fieldset className="ballot__section">
                <legend className="ballot__label">Stamp one</legend>
                <div className="stamps" role="radiogroup" aria-label="Stars">
                  {([3, 2, 1] as Stars[]).map((n) => (
                    <button
                      key={n}
                      role="radio"
                      aria-checked={stars === n}
                      aria-label={`${starWord(n)}, ${CAPTION[n]}`}
                      className={`stamp stamp--${n}`}
                      onClick={() => chooseStars(n)}
                      data-autofocus={n === 3 ? true : undefined}
                    >
                      <span className="stamp__face">
                        <span className="stamp__stars">
                          {Array.from({ length: n }, (_, i) => <StarIcon key={i} size={16} fill="currentColor" stroke="currentColor" />)}
                        </span>
                        <span className="stamp__word">{CAPTION[n]}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              {stars && (
                <fieldset className="ballot__section rise" key={`r${stars}`}>
                  <legend className="ballot__label">{HINT[stars]}</legend>
                  <div className="ticks">
                    {orderedLabels.map((l) => (
                      <label key={l.id} className={`tick tick--${l.tone}`}>
                        <input type="checkbox" checked={picked.includes(l.id)} onChange={() => toggle(l.id)} />
                        <span className="tick__box" aria-hidden="true">
                          <svg viewBox="0 0 20 20"><path d="M4 10.5 L8.5 15 L16 5" /></svg>
                        </span>
                        <span>{l.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {stars && stars <= 2 && (
                <div className="ballot__section rise">
                  <label htmlFor="explain" className="ballot__label">
                    {stars === 1 ? 'What happened? Required, only staff read it.' : 'A note for staff. Optional.'}
                  </label>
                  <textarea
                    id="explain"
                    className="ballot__note"
                    rows={stars === 1 ? 4 : 2}
                    maxLength={1000}
                    placeholder={stars === 1 ? 'Describe what happened.' : 'Only staff can read this.'}
                    value={explanation}
                    onChange={(e) => {
                      setExplanation(e.target.value);
                      setError('');
                    }}
                  />
                  {stars === 1 && (
                    <p className="ballot__fine">
                      Staff read every 1-star ballot. {target.first_name} never sees who sent it.
                    </p>
                  )}
                </div>
              )}
            </article>

            <div className="sheet__foot">
              {error && <p className="error" role="alert">{error}</p>}
              <button className="btn btn--ink btn--block" onClick={submit} aria-busy={busy} disabled={!stars}>
                {busy ? 'Dropping it in…' : stars ? 'Drop in the box' : 'Stamp the ballot first'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && result && target && (
          <div className="sheet__body done">
            <BallotBox stars={stars ?? 3} name={target.first_name} />
            <p className="done__text">
              Your ballot for {target.first_name} counts now. Only staff can see it came from you.
            </p>
            <p className="done__left">
              {result.allowance.votes_used} of {votingWindow.max_votes} in the box
              {result.allowance.votes_used < votingWindow.min_votes
                ? `, ${votingWindow.min_votes - result.allowance.votes_used} more to reach the minimum`
                : ''}
            </p>
            <div className="done__actions">
              {result.allowance.votes_remaining > 0 && (
                <button className="btn btn--accent" onClick={startAnother} data-autofocus>Rate someone else</button>
              )}
              <button className="btn btn--ghost" onClick={onClose}>Back home</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

