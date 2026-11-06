import { useCallback, useEffect, useRef, useState } from 'react';
import { Monogram } from '../components/Monogram';
import { Icon, StarMeter, Wordmark, pad, starWord, useCountdown } from '../components/bits';
import { api, type Dashboard, type GivenRating, type HistoryPoint, type Participation } from '../api';
import { useSession } from '../session';
import { ACCENTS } from './Onboarding';
import { RateSheet } from './RateSheet';

const STATE_TEXT: Record<GivenRating['state'], string> = {
  counted: 'Counted',
  held: 'Under review',
  rejected: 'Not counted',
  invalidated: 'Not counted',
};

export function Home() {
  const { me, logout, saveProfile, previewAccent } = useSession();
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [part, setPart] = useState<Participation | null>(null);
  const [given, setGiven] = useState<GivenRating[]>([]);
  const [loadError, setLoadError] = useState('');
  const [rating, setRating] = useState(false);
  const saveTimer = useRef<number>();

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setDash(d);
      const [h, p, g] = await Promise.all([
        api.history(),
        api.participation(),
        d.window ? api.given(d.window.id) : Promise.resolve([]),
      ]);
      setHistory(h);
      setPart(p);
      setGiven(g);
      setLoadError('');
    } catch {
      setLoadError('Couldn’t load your dashboard. Check your connection and refresh.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const countdown = useCountdown(dash?.window?.ends_at, dash?.server_time);
  if (!me) return null;

  const profile = me.profile!;
  const accent = profile.accent;
  const average = dash?.own_rating.average ?? null;
  // The rating as it stood when each window closed. A window with too few raters adds nothing,
  // so the rating carries over unchanged from the window before.
  let carry: number | null = null;
  const points = history.map((h) => {
    if (h.state !== 'closed') return { ...h, value: null, carried: false };
    if (h.average !== null) carry = h.average;
    return { ...h, value: carry, carried: h.average === null && carry !== null };
  });
  const closed = points.filter((p) => p.value !== null);
  const lastClosed = closed[closed.length - 1];
  const delta = closed.length >= 2 ? closed[closed.length - 1].value! - closed[closed.length - 2].value! : null;
  const win = dash?.window ?? null;
  const allowance = dash?.allowance ?? null;
  const used = allowance?.votes_used ?? 0;
  const left = allowance?.votes_remaining ?? 0;
  const max = win?.max_votes ?? 0;
  const min = win?.min_votes ?? 0;

  function changeAccent(hex: string) {
    previewAccent(hex);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveProfile({ ...profile, accent: hex }).catch(() => previewAccent(accent));
    }, 400);
  }

  return (
    <div className="home">
      <header className="home__bar">
        <Wordmark size={26} />
        <div className="home__who">
          <span className="mono muted">{me.intra_username}</span>
          <button className="icon-btn" aria-label="Sign out" onClick={() => logout()}>
            <Icon name="logout" />
          </button>
        </div>
      </header>

      {loadError && <p className="error home__error" role="alert">{loadError}</p>}

      <div className="home__grid">
        <section className="poster rise" aria-label="Your profile">
          <div className="poster__figure">
            <Monogram first={me.first_name} last={me.last_name} label={`${me.first_name} ${me.last_name}`} />
          </div>
          <div className="poster__info">
            <p className="mono poster__login">{me.first_name} {me.last_name}</p>
            <div className="poster__rating">
              <p className="poster__number">{average === null ? '–' : average.toFixed(1)}</p>
              <div className="poster__meta">
                {average !== null && <StarMeter value={average} size={24} emptyFill="#2E333A" stroke="transparent" />}
                <p className="poster__sub">
                  {average === null
                    ? 'Not enough ratings yet'
                    : delta === null
                      ? 'your rating'
                      : `your rating · ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(1)}`}
                </p>
              </div>
            </div>
            <p className="poster__note">Updates when a voting window closes.</p>
          </div>
          <div className="poster__accent">
            <span>Accent</span>
            <div className="poster__swatches" role="radiogroup" aria-label="Accent color">
              {ACCENTS.map((a) => (
                <button
                  key={a.hex}
                  role="radio"
                  aria-checked={accent === a.hex}
                  aria-label={a.name}
                  className="mini-swatch"
                  style={{ background: a.hex }}
                  onClick={() => changeAccent(a.hex)}
                />
              ))}
            </div>
          </div>
        </section>

        <div className="home__col">
          <section className="card card--strong window rise" style={{ animationDelay: '60ms' }} aria-label="Voting window">
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
                  <p className="countdown mono" aria-label={`${countdown.d} days ${countdown.h} hours ${countdown.m} minutes left`}>
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
              </>
            )}
          </section>

          <section className="card history rise" style={{ animationDelay: '120ms' }} aria-label="Your rating over time">
            <div className="card__head">
              <h2>Your rating over time</h2>
              <span className="muted">one bar per voting window</span>
            </div>
            <div className="bars">
              {points.map((h, i) => (
                <div key={h.window_id} className="bars__col" title={h.carried ? `${h.name}: too few raters, so your rating didn’t change` : h.name}>
                  <span className="mono bars__value">{h.state === 'open' ? '…' : h.value === null ? '–' : h.value.toFixed(1)}</span>
                  <span
                    className={`bars__bar ${h.state === 'open' ? 'bars__bar--open' : h.value === null ? 'bars__bar--none' : h.carried ? 'bars__bar--carried' : ''} ${h === lastClosed && !h.carried ? 'bars__bar--last' : ''}`}
                    style={h.value !== null ? { height: `${Math.round(((h.value - 1) / 2) * 100) + 12}px` } : undefined}
                  />
                  <span className="mono bars__label">{h.state === 'open' ? 'Now' : `#${i + 1}`}</span>
                </div>
              ))}
            </div>
            <p className="muted card__foot">When too few people rate you in a window, your rating stays as it was (lighter bar), so no change can be traced to one vote.</p>
          </section>

          <section className="card part rise" style={{ animationDelay: '180ms' }} aria-label="Your participation">
            <div className="part__stats">
              <h2>Your participation</h2>
              <div className="streak">
                <span className="mono streak__n">{part?.streak ?? '–'}</span>
                <span>windows in a row where you reached the minimum</span>
              </div>
              <div className="part__row">
                <div><p className="mono part__num">{part ? `${part.windows_joined}/${part.windows_total}` : '–'}</p><p className="muted">windows joined</p></div>
                <div><p className="mono part__num">{part?.votes_given_total ?? '–'}</p><p className="muted">votes given</p></div>
              </div>
            </div>
            <div className="part__given">
              <p className="muted">Rated this window{win ? ` · ${used}/${max}` : ''}</p>
              {given.length === 0 ? (
                <p className="part__empty">Nobody yet. Your votes will show up here, only for you.</p>
              ) : (
                <ul className="given">
                  {given.map((g) => (
                    <li key={g.rating_id}>
                      <span className="mono">{g.recipient.intra_username}</span>
                      <span className={`given__state given__state--${g.state}`}>
                        {g.state === 'counted' ? starWord(g.stars) : STATE_TEXT[g.state]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
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
