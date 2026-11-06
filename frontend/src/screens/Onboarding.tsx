import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BEARDS, CAP_COLORS, Character, EYES, GLASSES, HAIRS, HAIR_COLORS, HIJABS, HIJAB_COLORS, HOODIES, MOUTHS, SKINS,
  normalizeSpec, randomSpec,
} from '../components/Character';
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
interface Group { key: Part; label?: string; options: string[]; colors?: string[] }
interface Tab { id: string; label: string; groups: Group[]; hiddenByHijab?: boolean }

const named = (colors: string[], prefix: string) => colors.map((_, i) => `${prefix} ${i + 1}`);
const TABS: Tab[] = [
  { id: 'hair', label: 'Hair', hiddenByHijab: true, groups: [
    { key: 'hair', options: HAIRS },
    { key: 'hairColor', label: 'Color', options: named(HAIR_COLORS, 'Hair color'), colors: HAIR_COLORS },
  ] },
  { id: 'beard', label: 'Beard', hiddenByHijab: true, groups: [{ key: 'beard', options: BEARDS }] },
  { id: 'hijab', label: 'Hijab', groups: [
    { key: 'hijab', options: HIJABS },
    { key: 'hijabColor', label: 'Color', options: named(HIJAB_COLORS, 'Hijab color'), colors: HIJAB_COLORS },
    { key: 'capColor', label: 'Undercap', options: named(CAP_COLORS, 'Undercap color'), colors: CAP_COLORS },
  ] },
  { id: 'face', label: 'Face', groups: [
    { key: 'eyes', label: 'Eyes', options: EYES },
    { key: 'mouth', label: 'Mouth', options: MOUTHS },
  ] },
  { id: 'glasses', label: 'Glasses', groups: [{ key: 'glasses', options: GLASSES }] },
  { id: 'skin', label: 'Skin', groups: [{ key: 'skin', options: named(SKINS, 'Skin tone'), colors: SKINS }] },
  { id: 'hoodie', label: 'Hoodie', groups: [{ key: 'hoodie', options: HOODIES }] },
];

const STEPS = ['You', 'How it works', 'Character', 'Color'];

export function Onboarding() {
  const { me, saveProfile, previewAccent } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [spec, setSpec] = useState<CharacterSpec>(() => normalizeSpec(me?.profile?.character));
  const [accent, setAccent] = useState(me?.profile?.accent ?? DEFAULT_ACCENT);
  const [tabId, setTabId] = useState('hair');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!me) return null;

  function pickAccent(hex: string) {
    setAccent(hex);
    previewAccent(hex);
  }

  function shuffle() {
    setSpec(randomSpec());
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
  const tab = TABS.find((t) => t.id === tabId)!;

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
            <div className="tabs tabs--scroll" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tabId === t.id} className="tabs__tab" onClick={() => setTabId(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            {tab.hiddenByHijab && spec.hijab > 0 && (
              <p className="muted parts__note">Hidden under your hijab. Set Hijab to None to change it.</p>
            )}
            {!(tab.hiddenByHijab && spec.hijab > 0) && tab.groups.map((g) => (
              <div key={g.key} className="parts__group">
                {g.label && <p className="parts__label">{g.label}</p>}
                {g.colors ? (
                  <div className="colors" role="radiogroup" aria-label={g.label ?? tab.label}>
                    {g.colors.map((c, i) => (
                      <button
                        key={c}
                        role="radio"
                        aria-checked={spec[g.key] === i}
                        aria-label={g.options[i]}
                        className="colors__dot"
                        style={{ background: c }}
                        onClick={() => setSpec({ ...spec, [g.key]: i })}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="parts" role="radiogroup" aria-label={g.label ?? tab.label}>
                    {g.options.map((name, i) => (
                      <button
                        key={name}
                        role="radio"
                        aria-checked={spec[g.key] === i}
                        aria-label={name}
                        className="parts__option"
                        onClick={() => setSpec({ ...spec, [g.key]: i })}
                      >
                        <Character spec={{ ...spec, [g.key]: i }} accent={accent} size="100%" crop={g.key === 'hoodie' ? 'full' : 'head'} />
                        <span className="parts__name">{name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
            <p className="muted onb__lead">It colors the whole app, only for you, and your hoodie if you set it to Accent. 42 cyan is the default. You can change it anytime.</p>
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
