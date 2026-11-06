import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BEARDS, BROWS, CAP_COLORS, Character, EYES, FACE_OPTIONS, GLASSES, HAIRSTYLES, HAIR_COLORS, HAIR_FOR, HIJABS,
  HIJAB_COLORS, HOODIES, MOUTHS, PRESETS, SKINS, genderOf, normalizeSpec, randomSpec, type Gender,
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
type TabId = 'hair' | 'face' | 'skin' | 'extras';
const TABS: { id: TabId; label: string }[] = [
  { id: 'hair', label: 'Hair' },
  { id: 'face', label: 'Face' },
  { id: 'skin', label: 'Skin' },
  { id: 'extras', label: 'Extras' },
];

const named = (colors: string[], prefix: string) => colors.map((_, i) => `${prefix} ${i + 1}`);
const sameSpec = (a: CharacterSpec, b: CharacterSpec) => (Object.keys(a) as Part[]).every((k) => a[k] === b[k]);
const all = (list: string[]) => list.map((_, i) => i);

interface Choice { id: string; name: string; spec: CharacterSpec; selected: boolean }

function Choices({ label, choices, crop, accent, onPick, size = 'md', hideNames }: {
  label: string; choices: Choice[]; crop: 'full' | 'head' | 'face'; accent: string;
  onPick(spec: CharacterSpec): void; size?: 'sm' | 'md' | 'presets'; hideNames?: boolean;
}) {
  return (
    <div className="parts__group">
      <p className="parts__label">{label}</p>
      <div className={`parts parts--${size}`} role="radiogroup" aria-label={label}>
        {choices.map((c) => (
          <button key={c.id} role="radio" aria-checked={c.selected} aria-label={c.name} className="parts__option" onClick={() => onPick(c.spec)}>
            <Character spec={c.spec} accent={accent} size="100%" crop={crop} />
            {!hideNames && <span className="parts__name">{c.name}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: number; onPick(i: number): void }) {
  const names = named(colors, label);
  return (
    <div className="parts__group">
      <p className="parts__label">{label}</p>
      <div className="colors" role="radiogroup" aria-label={label}>
        {colors.map((c, i) => (
          <button key={c} role="radio" aria-checked={value === i} aria-label={names[i]} className="colors__dot" style={{ background: c }} onClick={() => onPick(i)} />
        ))}
      </div>
    </div>
  );
}

const STEPS = ['You', 'How it works', 'Character', 'Color'];

export function Onboarding() {
  const { me, saveProfile, previewAccent } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [spec, setSpec] = useState<CharacterSpec>(() => normalizeSpec(me?.profile?.character));
  const [accent, setAccent] = useState(me?.profile?.accent ?? DEFAULT_ACCENT);
  const [tabId, setTabId] = useState<TabId>('hair');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!me) return null;

  function pickAccent(hex: string) {
    setAccent(hex);
    previewAccent(hex);
  }

  const gender = genderOf(spec);
  const set = (patch: Partial<CharacterSpec>) => setSpec({ ...spec, ...patch });
  const variants = (key: Part, list: number[], names: string[]): Choice[] =>
    list.map((i) => ({ id: `${key}-${i}`, name: names[i], spec: { ...spec, [key]: i }, selected: spec[key] === i }));

  function chooseGender(g: Gender) {
    if (g !== gender) setSpec(PRESETS[g][0]);
  }

  function shuffle() {
    setSpec(randomSpec(gender));
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
            <div className="onb__pinned" aria-hidden="true">
              <div className="onb__mobile-figure">
                <Character spec={spec} accent={accent} size="100%" />
              </div>
            </div>
            <div className="onb__row">
              <div>
                <p className="eyebrow">Your character</p>
                <h1 className="onb__title">Make it yours.</h1>
              </div>
              <button className="btn btn--ghost" onClick={shuffle}>Shuffle</button>
            </div>

            <div className="seg" role="radiogroup" aria-label="Character type">
              {(['boy', 'girl'] as Gender[]).map((g) => (
                <button key={g} role="radio" aria-checked={gender === g} className="seg__btn" onClick={() => chooseGender(g)}>
                  {g === 'boy' ? 'Boy' : 'Girl'}
                </button>
              ))}
            </div>

            <Choices
              label="Start from one"
              crop="head"
              accent={accent}
              onPick={setSpec}
              size="presets"
              hideNames
              choices={PRESETS[gender].map((s, i) => ({ id: `preset-${i}`, name: `Starting look ${i + 1}`, spec: s, selected: sameSpec(s, spec) }))}
            />

            <div className="parts__group">
              <p className="parts__label">Then make it yours</p>
              <div className="tabs" role="tablist">
                {TABS.map((t) => (
                  <button key={t.id} role="tab" aria-selected={tabId === t.id} className="tabs__tab" onClick={() => setTabId(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {tabId === 'hair' && (
              <>
                <Choices
                  label={gender === 'girl' ? 'Hair or hijab' : 'Style'}
                  crop="head"
                  accent={accent}
                  onPick={setSpec}
                  choices={[
                    ...HAIR_FOR[gender].map((i) => ({
                      id: `hair-${i}`, name: HAIRSTYLES[i].name, spec: { ...spec, hair: i, hijab: 0 }, selected: !spec.hijab && spec.hair === i,
                    })),
                    ...(gender === 'girl'
                      ? all(HIJABS).slice(1).map((h) => ({
                        id: `hijab-${h}`, name: `Hijab · ${HIJABS[h]}`, spec: { ...spec, hijab: h }, selected: spec.hijab === h,
                      }))
                      : []),
                  ]}
                />
                {spec.hijab ? (
                  <>
                    <Swatches label="Hijab color" colors={HIJAB_COLORS} value={spec.hijabColor} onPick={(i) => set({ hijabColor: i })} />
                    <Swatches label="Undercap" colors={CAP_COLORS} value={spec.capColor} onPick={(i) => set({ capColor: i })} />
                  </>
                ) : (
                  <Swatches label="Hair color" colors={HAIR_COLORS} value={spec.hairColor} onPick={(i) => set({ hairColor: i })} />
                )}
              </>
            )}

            {tabId === 'face' && (
              <>
                <Choices label="Eyes" crop="face" size="sm" accent={accent} onPick={setSpec} choices={variants('eyes', FACE_OPTIONS[gender].eyes, EYES)} />
                {!spec.hijab && (
                  <Choices label="Brows" crop="face" size="sm" accent={accent} onPick={setSpec} choices={variants('brows', FACE_OPTIONS[gender].brows, BROWS)} />
                )}
                <Choices label="Mouth" crop="face" size="sm" accent={accent} onPick={setSpec} choices={variants('mouth', FACE_OPTIONS[gender].mouth, MOUTHS)} />
                {gender === 'boy' && (
                  <Choices label="Beard" crop="face" size="sm" accent={accent} onPick={setSpec} choices={variants('beard', all(BEARDS), BEARDS)} />
                )}
              </>
            )}

            {tabId === 'skin' && (
              <Swatches label="Skin tone" colors={SKINS} value={spec.skin} onPick={(i) => set({ skin: i })} />
            )}

            {tabId === 'extras' && (
              <>
                <Choices label="Glasses" crop="head" accent={accent} onPick={setSpec} choices={variants('glasses', all(GLASSES), GLASSES)} />
                <Choices label="Hoodie" crop="full" accent={accent} onPick={setSpec} choices={variants('hoodie', all(HOODIES), HOODIES)} />
              </>
            )}

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
