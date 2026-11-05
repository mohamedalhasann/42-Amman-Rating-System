import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Character, DEFAULT_CHARACTER, EYES, HAIRS, ITEMS, SKINS } from '../components/Character';
import { Icon, StarIcon, Wordmark, initials } from '../components/bits';
import { DEFAULT_ACCENT, useSession } from '../session';
import { ApiError, type CharacterSpec } from '../api';

export const ACCENTS: { hex: string; name: string }[] = [
  { hex: '#00BABC', name: '42 cyan' },
  { hex: '#5BA4FF', name: 'Sky' },
  { hex: '#8FD16A', name: 'Lime' },
  { hex: '#F2A541', name: 'Amber' },
  { hex: '#FF8A80', name: 'Coral' },
  { hex: '#B79CF2', name: 'Lilac' },
];

type Part = keyof CharacterSpec;
const PARTS: { key: Part; label: string; options: string[] }[] = [
  { key: 'hair', label: 'Hair', options: HAIRS },
  { key: 'eyes', label: 'Eyes', options: EYES },
  { key: 'skin', label: 'Skin', options: SKINS.map((_, i) => `Tone ${i + 1}`) },
  { key: 'item', label: 'Extras', options: ITEMS },
];

const STEPS = ['You', 'How it works', 'Character', 'Color'];

export function Onboarding() {
  const { me, saveProfile, previewAccent } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [spec, setSpec] = useState<CharacterSpec>(me?.profile?.character ?? DEFAULT_CHARACTER);
  const [accent, setAccent] = useState(me?.profile?.accent ?? DEFAULT_ACCENT);
  const [part, setPart] = useState<Part>('hair');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!me) return null;

  function pickAccent(hex: string) {
    setAccent(hex);
    previewAccent(hex);
  }

  function shuffle() {
    const r = (n: number) => Math.floor(Math.random() * n);
    setSpec({ skin: r(SKINS.length), hair: r(HAIRS.length), eyes: r(EYES.length), item: r(ITEMS.length) });
  }

  async function finish() {
    setBusy(true);
    setError('');
    try {
      await saveProfile({ character: spec, accent, onboarded: true });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t save. Try again.');
      setBusy(false);
    }
  }

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const activePart = PARTS.find((p) => p.key === part)!;

  return (
    <div className="onb">
      <aside className={`onb__stage ${step >= 2 ? 'onb__stage--show' : ''}`}>
        <Wordmark size={26} onInk />
        <div className="onb__figure">
                    <Character spec={spec} accent={accent} size="100%" className="bob" label="Your character" />
        </div>
        <p className="mono onb__tag">{me.intra_username}</p>
      </aside>

      <main className="onb__main">
        <div className="onb__top">
          <button className="icon-btn" onClick={back} aria-label="Back" disabled={step === 0} style={{ visibility: step === 0 ? 'hidden' : 'visible' }}>
            <Icon name="back" />
          </button>
          <ol className="onb__progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <li key={s} className={i <= step ? 'is-done' : ''}><span className="visually-hidden">{s}</span></li>
            ))}
          </ol>
          <span className="mono muted onb__count">{step + 1}/{STEPS.length}</span>
        </div>

        {step === 0 && (
          <section className="onb__step rise" key="you">
            <p className="eyebrow">Welcome to Fairly</p>
            <h1 className="onb__title">Hi {me.first_name}.</h1>
            <div className="idcard">
              <div className="idcard__avatar mono" aria-hidden="true">
                {me.picture_url ? <img src={me.picture_url} alt="" /> : initials(me.first_name, me.last_name)}
              </div>
              <div>
                <p className="idcard__name">{me.first_name} {me.last_name}</p>
                <p className="mono muted">{me.intra_username} · 42 Amman</p>
              </div>
            </div>
            <p className="muted onb__lead">Your name comes from 42 intra, so other students can find you when they want to rate you. Let’s set you up in under a minute.</p>
            <button className="btn btn--accent btn--block" onClick={next}>That’s me</button>
          </section>
        )}

        {step === 1 && (
          <section className="onb__step rise" key="how">
            <p className="eyebrow">How it works</p>
            <h1 className="onb__title">Four things to know.</h1>
            <ul className="rules">
              <li>
                <span className="rules__icon"><Icon name="lock" size={22} /></span>
                <div><b>Your votes are anonymous.</b><p className="muted">Students never see who rated them. Only staff can.</p></div>
              </li>
              <li>
                <span className="rules__icon"><StarIcon fill="var(--accent)" size={24} /></span>
                <div><b>Three stars, three meanings.</b><p className="muted">3 is positive, 2 is mixed, 1 is a serious issue.</p></div>
              </li>
              <li>
                <span className="rules__icon"><Icon name="scale" size={22} /></span>
                <div><b>1 star goes to staff first.</b><p className="muted">It needs a reason and a short explanation, and only counts after staff review it.</p></div>
              </li>
              <li>
                <span className="rules__icon"><Icon name="clock" size={22} /></span>
                <div><b>Voting happens in windows.</b><p className="muted">Each window has a deadline and a set number of votes. You see your own rating, nothing else.</p></div>
              </li>
            </ul>
            <button className="btn btn--accent btn--block" onClick={next}>Make my character</button>
          </section>
        )}

        {step === 2 && (
          <section className="onb__step rise" key="char">
            <div className="onb__mobile-figure" aria-hidden="true">
                            <Character spec={spec} accent={accent} size="100%" className="bob" />
            </div>
            <div className="onb__row">
              <div>
                <p className="eyebrow">Your character</p>
                <h1 className="onb__title">Make it yours.</h1>
              </div>
              <button className="btn btn--ghost" onClick={shuffle}>Shuffle</button>
            </div>
            <div className="tabs" role="tablist">
              {PARTS.map((p) => (
                <button key={p.key} role="tab" aria-selected={part === p.key} className="tabs__tab" onClick={() => setPart(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="parts" role="radiogroup" aria-label={activePart.label}>
              {activePart.options.map((name, i) => {
                const selected = spec[part] === i;
                return (
                  <button
                    key={name}
                    role="radio"
                    aria-checked={selected}
                    aria-label={name}
                    className="parts__option"
                    onClick={() => setSpec({ ...spec, [part]: i })}
                  >
                    {part === 'skin' ? (
                      <span className="parts__swatch" style={{ background: SKINS[i] }} />
                    ) : (
                      <Character spec={{ ...spec, [part]: i }} accent={accent} size="100%" crop="head" />
                    )}
                    <span className="parts__name">{name}</span>
                  </button>
                );
              })}
            </div>
            <button className="btn btn--accent btn--block" onClick={next}>Next: pick a color</button>
          </section>
        )}

        {step === 3 && (
          <section className="onb__step rise" key="color">
            <div className="onb__mobile-figure" aria-hidden="true">
                            <Character spec={spec} accent={accent} size="100%" className="bob" />
            </div>
            <p className="eyebrow">Your color</p>
            <h1 className="onb__title">Pick your accent.</h1>
            <p className="muted onb__lead">It colors your hoodie and the whole app, only for you. 42 cyan is the default. You can change it anytime.</p>
            <div className="swatches" role="radiogroup" aria-label="Accent color">
              {ACCENTS.map((a) => (
                <button
                  key={a.hex}
                  role="radio"
                  aria-checked={accent === a.hex}
                  className="swatch"
                  onClick={() => pickAccent(a.hex)}
                >
                  <span className="swatch__dot" style={{ background: a.hex }} />
                  <span className="swatch__name">{a.name}</span>
                </button>
              ))}
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn btn--accent btn--block" onClick={finish} aria-busy={busy}>
              {busy ? 'Saving…' : 'Enter Fairly'}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
