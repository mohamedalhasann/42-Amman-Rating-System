import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Monogram } from '../components/Monogram';
import { Icon, StarMeter, Wordmark, pad, starWord, useCountdown } from '../components/bits';
import { api, type Dashboard, type GivenRating, type HistoryPoint } from '../api';
import { useSession } from '../session';
import { ACCENTS, knownAccent } from '../accents';
import { RateSheet } from './RateSheet';

const STATE_TEXT: Record<GivenRating['state'], string> = {
  counted: 'Counted',
  invalidated: 'Not counted',
};

export function Home() {
  const { me } = useSession();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [given, setGiven] = useState<GivenRating[]>([]);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setDash(d);
      const [h, g] = await Promise.all([
        api.history(),
        d.window ? api.given(d.window.id) : Promise.resolve([]),
      ]);
      setHistory(h);
      setGiven(g);
      setLoadError('');
    } catch {
      setLoadError('Couldn’t load your dashboard. Check your connection and try again.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countdown = useCountdown(dash?.window?.ends_at, dash?.server_time);
  if (!me) return null;

  const average = dash?.own_rating.average ?? null;
  // The rating as it stood when each window closed. A window with too few raters adds nothing,
  // so the rating carries over unchanged from the window before.
  let carry: number | null = null;
  const points = history.map((h) => {
    if (h.state !== 'closed') return { ...h, value: null, carried: false };
    if (h.average !== null) carry = h.average;
    return { ...h, value: carry, carried: h.average === null && carry !== null };
  });
  // Change since the last window that actually moved the rating; carried windows don't count.
  const moved = points.filter((p) => p.state === 'closed' && p.value !== null && !p.carried);
  const lastMoved = moved[moved.length - 1];
  const prevMoved = moved[moved.length - 2];
  const delta = lastMoved && prevMoved ? Math.round((lastMoved.value! - prevMoved.value!) * 10) / 10 : null;
  const anyCarried = points.some((p) => p.carried);
  const win = dash?.window ?? null;
  const allowance = dash?.allowance ?? null;
  const used = allowance?.votes_used ?? 0;
  const left = allowance?.votes_remaining ?? 0;
  const max = win?.max_votes ?? 0;
  const min = win?.min_votes ?? 0;

  return (
    <div className="home">
      <header className="home__bar">
        <Wordmark size={26} />
        <UserMenu />
      </header>

      {loadError && (
        <div className="home__error" role="alert">
          <p>{loadError}</p>
          <button className="btn btn--ghost" onClick={load}>Try again</button>
        </div>
      )}

      <div className="home__grid">
        <section className="poster home__poster rise" aria-labelledby="poster-title">
          <div className="poster__who">
            <div className="poster__badge">
              <Monogram first={me.first_name} last={me.last_name} />
            </div>
            <div className="poster__names">
              <p className="poster__name">{me.first_name} {me.last_name}</p>
              <p className="mono poster__login">{me.intra_username}</p>
            </div>
          </div>

          <div className="poster__info">
            <h2 id="poster-title" className="poster__label">Your rating</h2>
            {!dash ? (
              <div className="poster__loading" aria-busy="true">
                <div className="skeleton skeleton--ink" style={{ height: 92, width: '60%' }} />
                <div className="skeleton skeleton--ink" style={{ height: 40 }} />
              </div>
            ) : average === null ? (
              <>
                <p className="poster__number poster__number--none">–</p>
                <p className="poster__sub">Not enough ratings yet. Your first rating appears when a window closes with enough people rating you.</p>
              </>
            ) : (
              <>
                <div className="poster__rating">
                  <p className="poster__number">
                    {average.toFixed(1)}<span className="poster__of">/ 3</span>
                  </p>
                  <StarMeter value={average} size={24} emptyFill="#2E333A" stroke="transparent" />
                </div>
                <p className="poster__sub">
                  {delta === null || !prevMoved
                    ? 'Your average across every window so far.'
                    : delta === 0
                      ? `No change since ${prevMoved.name}.`
                      : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta).toFixed(1)} since ${prevMoved.name}.`}
                </p>
                {delta !== null && delta < 0 && (
                  <p className="poster__care">It averages every window, so one window moves it only a little.</p>
                )}
              </>
            )}
            <p className="poster__note">Updates when a voting window closes.</p>
          </div>
        </section>

          <section className="card card--strong window home__window rise" style={{ animationDelay: '60ms' }} aria-label="Voting window">
            {!dash ? (
              <div className="skeleton" style={{ height: 180 }} />
            ) : !win ? (
              <div className="window__closed">
                <p className="window__label">No voting window is open</p>
                <p className="muted">Staff will open the next one. Your rating stays here in the meantime.</p>
              </div>
            ) : (
              <>
                <div className="window__top">
                  <p className="window__label">{win.name} closes in</p>
                  <p className="mono window__live"><span className="window__dot" /> open</p>
                </div>
                {countdown && (
                  <p className="countdown mono" role="timer" aria-label={`${countdown.d} days ${countdown.h} hours ${countdown.m} minutes left`}>
                    <span>{countdown.d}<small>d</small></span>
                    <span>{pad(countdown.h)}<small>h</small></span>
                    <span>{pad(countdown.m)}<small>m</small></span>
                    <span className="countdown__s">{pad(countdown.s)}<small>s</small></span>
                  </p>
                )}
                <div className="slots" aria-hidden="true">
                  {Array.from({ length: Math.min(max, 12) }, (_, i) => (
                    <span key={i} className={`slot ${i < used ? 'slot--used' : i < min ? 'slot--min' : ''}`} />
                  ))}
                </div>
                <div className="window__bottom">
                  <div>
                    <p className="window__left">{left} of {max} votes left</p>
                    <p className="muted window__min">
                      {min === 0 ? 'No minimum this window' : used >= min ? 'Minimum reached' : `${min - used} more to reach the minimum of ${min}`}
                    </p>
                  </div>
                  {left > 0 ? (
                    <button className="btn btn--accent window__cta" onClick={() => setRating(true)}>Rate someone</button>
                  ) : (
                    <p className="window__done">All votes used. See you next window.</p>
                  )}
                </div>
                <div className="window__given">
                  <p className="window__given-title">You rated <span className="muted">· only you see this</span></p>
                  {given.length === 0 ? (
                    <p className="given__empty">You haven’t rated anyone this window yet.</p>
                  ) : (
                    <ul className="given">
                      {given.map((g) => (
                        <li key={g.rating_id}>
                          <span>{g.recipient.first_name} {g.recipient.last_name}</span>
                          <span className={`given__state given__state--${g.state}`}>
                            {g.state === 'counted' ? starWord(g.stars) : STATE_TEXT[g.state]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </section>

          <section className="card history home__history rise" style={{ animationDelay: '120ms' }} aria-labelledby="history-title">
            <div className="card__head">
              <h2 id="history-title">Your rating over time</h2>
              <span className="muted">one bar per voting window</span>
            </div>
            <ol className="bars">
              {points.map((h) => {
                const text =
                  h.state === 'open'
                    ? `${h.name}: open now.`
                    : h.carried
                      ? `${h.name}: too few raters, so your rating stayed at ${h.value!.toFixed(1)}.`
                      : h.value === null
                        ? `${h.name}: too few raters, no rating yet.`
                        : `${h.name}: ${h.value.toFixed(1)}.`;
                return (
                  <li key={h.window_id} className={`bars__col ${h.carried ? 'bars__col--carried' : ''}`}>
                    <span className="mono bars__value" aria-hidden="true">
                      {h.state === 'open' ? '…' : h.value === null ? '–' : h.value.toFixed(1)}
                    </span>
                    {h.carried && <span className="bars__kept" aria-hidden="true">kept</span>}
                    <span
                      aria-hidden="true"
                      className={`bars__bar ${h.state === 'open' ? 'bars__bar--open' : h.value === null ? 'bars__bar--none' : h.carried ? 'bars__bar--carried' : ''} ${h === lastMoved ? 'bars__bar--last' : ''}`}
                      style={h.value !== null ? ({ ['--f' as string]: ((h.value - 1) / 2).toFixed(3) }) : undefined}
                    />
                    <span className="visually-hidden">{text}</span>
                  </li>
                );
              })}
            </ol>
            {anyCarried && (
              <p className="bars__legend">
                <span className="bars__key" aria-hidden="true" /> Kept: too few raters, so no change.
              </p>
            )}
          </section>
      </div>

      {rating && win && (
        <RateSheet
          votingWindow={win}
          ratedIds={given.map((g) => g.recipient.recipient_id)}
          onClose={() => {
            setRating(false);
            load();
          }}
          onSubmitted={(res) => {
            setDash((d) => (d ? { ...d, allowance: res.allowance } : d));
            api.given(win.id).then(setGiven).catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}

// The username opens a small menu: accent colour and sign out.
function UserMenu() {
  const { me, logout, saveProfile, previewAccent } = useSession();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const saveTimer = useRef<number>();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!me) return null;
  const profile = me.profile!;
  const accent = knownAccent(profile.accent);

  function changeAccent(hex: string) {
    previewAccent(hex);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveProfile({ ...profile, accent: hex }).catch(() => previewAccent(accent));
    }, 400);
  }

  function onSwatchKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + ACCENTS.length) % ACCENTS.length;
    changeAccent(ACCENTS[next].hex);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  }

  return (
    <div className="menu" ref={wrap}>
      <button ref={trigger} className="menu__trigger" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        <span className="menu__dot" aria-hidden="true" />
        <span className="mono">{me.intra_username}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <div className="menu__panel">
          <p className="menu__name">{me.first_name} {me.last_name}</p>
          <p className="menu__label" id="accent-label">Accent</p>
          <div className="menu__swatches" role="radiogroup" aria-labelledby="accent-label">
            {ACCENTS.map((a, i) => (
              <button
                key={a.hex}
                role="radio"
                aria-checked={accent === a.hex}
                aria-label={a.name}
                tabIndex={accent === a.hex ? 0 : -1}
                className="mini-swatch"
                style={{ background: a.hex }}
                onClick={() => changeAccent(a.hex)}
                onKeyDown={(e) => onSwatchKey(e, i)}
              />
            ))}
          </div>
          <button className="menu__item" onClick={() => logout()}>
            <Icon name="logout" size={18} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
