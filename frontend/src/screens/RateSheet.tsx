import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  2: 'Anything worth noting? Optional.',
  1: 'Pick at least one reason.',
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

  // While a vote is sending, the sheet can't be closed: the result has to land somewhere.
  const busyRef = useRef(false);
  busyRef.current = busy;
  const close = useCallback(() => {
    if (!busyRef.current) onClose();
  }, [onClose]);

  // A retry of the same vote reuses its key; any change to the vote makes it a new submission.
  useEffect(() => {
    idempotency.current = crypto.randomUUID();
  }, [target, stars, picked, explanation]);

  // Close with Escape, keep the page behind from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

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
    if (!target || !stars) return setError('Pick 1 to 3 stars first.');
    if (stars === 1 && picked.length === 0) return setError('Pick a reason to continue.');
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

  const orderedLabels = useMemo(() => {
    const rank = { positive: 0, concern: 1, flag: 2 } as const;
    return [...labels].sort((a, b) => (stars === 1 ? rank[b.tone] - rank[a.tone] : rank[a.tone] - rank[b.tone]));
  }, [labels, stars]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button className="sheet__backdrop" aria-label="Close" onClick={close} />
      <div className="sheet__panel" ref={panelRef}>
        <div className="sheet__head">
          {step === 'form' ? (
            <button className="icon-btn" aria-label="Back to search" disabled={busy} onClick={() => setStep('search')}>
              <Icon name="back" />
            </button>
          ) : (
            <span />
          )}
          <h2 id="sheet-title" className="sheet__title">
            {step === 'search' ? 'Who do you want to rate?' : step === 'form' ? 'Your vote' : 'Vote counted'}
          </h2>
          <button className="icon-btn" aria-label="Close" disabled={busy} onClick={close}>
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
                      {done ? <span className="peer__tag">Rated</span> : <span className="peer__go" aria-hidden="true">→</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {step === 'form' && target && (
          <div className="sheet__body">
            <div className="target">
              <span className="peer__avatar peer__avatar--lg mono" aria-hidden="true">{initials(target.first_name, target.last_name)}</span>
              <div>
                <p className="target__name">{target.first_name} {target.last_name}</p>
                <p className="mono muted">{target.intra_username}</p>
              </div>
            </div>

            <div className="stars" role="radiogroup" aria-label="Stars">
              {([1, 2, 3] as Stars[]).map((n) => {
                const active = stars === n;
                return (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={active}
                    className={`stars__btn stars__btn--${n}`}
                    onClick={() => chooseStars(n)}
                    data-autofocus={n === 3 ? true : undefined}
                  >
                    <span className="stars__icons">
                      {[1, 2, 3].map((i) => (
                        <span key={i} className={active && i <= n ? 'pop' : ''} style={{ animationDelay: `${(i - 1) * 60}ms` }}>
                          <StarIcon size={20} fill={i <= n ? (n === 1 && active ? 'var(--ink)' : active ? 'var(--accent)' : '#C9CDC7') : 'transparent'} stroke={i <= n ? 'var(--ink)' : '#C9CDC7'} />
                        </span>
                      ))}
                    </span>
                    <span className="stars__caption">{CAPTION[n]}</span>
                  </button>
                );
              })}
            </div>

            {stars && (
              <div className="labels rise" key={stars}>
                <p className="muted">{HINT[stars]}</p>
                <div className="labels__list">
                  {orderedLabels.map((l) => (
                    <button
                      key={l.id}
                      className={`chip chip--${l.tone}`}
                      aria-pressed={picked.includes(l.id)}
                      onClick={() => toggle(l.id)}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {stars && stars <= 2 && (
              <div className="field rise">
                <label htmlFor="explain">
                  {stars === 1 ? 'What happened?' : 'Add a note'} <span className="muted">{stars === 1 ? '(required, only staff read it)' : '(optional)'}</span>
                </label>
                <textarea
                  id="explain"
                  className="input textarea"
                  rows={stars === 1 ? 4 : 2}
                  maxLength={1000}
                  placeholder={stars === 1 ? 'Describe what happened. Only staff read it.' : 'Only staff can read this.'}
                  value={explanation}
                  onChange={(e) => {
                    setExplanation(e.target.value);
                    setError('');
                  }}
                />
                {stars === 1 && (
                  <p className="notice">
                    <Icon name="scale" size={18} /> A 1-star vote counts right away. Staff read your explanation if they look into it, and never tell {target.first_name} who sent it.
                  </p>
                )}
              </div>
            )}

            <div className="sheet__foot">
              {error && <p className="error" role="alert">{error}</p>}
              <button className="btn btn--ink btn--block" onClick={submit} aria-busy={busy} disabled={!stars}>
                {busy ? 'Sending…' : stars ? `Submit ${starWord(stars)}` : 'Pick stars to continue'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && result && target && (
          <div className="sheet__body done">
            <div className="done__badge pop" aria-hidden="true">
              <Icon name="check" size={40} />
            </div>
            <p className="done__text">
              {`Your vote for ${target.first_name} counts. Nobody but staff can see it came from you.`}
            </p>
            <p className="mono done__left">
              {result.allowance.votes_remaining} vote{result.allowance.votes_remaining === 1 ? '' : 's'} left in this window
            </p>
            <div className="done__actions">
              {result.allowance.votes_remaining > 0 && (
                <button className="btn btn--accent" onClick={startAnother}>Rate someone else</button>
              )}
              <button className="btn btn--ghost" onClick={onClose}>Back home</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

