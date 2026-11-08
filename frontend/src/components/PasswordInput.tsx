import { useState, type KeyboardEvent, type Ref } from 'react';
import { Icon } from './bits';

// A password field with a show/hide toggle and a Caps Lock warning.
export function PasswordInput({ id, value, onChange, autoComplete, autoFocus, inputRef, describedBy }: {
  id: string;
  value: string;
  onChange(value: string): void;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const readCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false);
  const capsId = `${id}-caps`;

  return (
    <>
      <div className="password">
        <input
          id={id}
          ref={inputRef}
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={readCaps}
          onKeyUp={readCaps}
          onBlur={() => setCaps(false)}
          aria-describedby={[caps ? capsId : '', describedBy ?? ''].filter(Boolean).join(' ') || undefined}
        />
        <button
          type="button"
          className="password__toggle"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          onClick={() => setShow((v) => !v)}
        >
          <Icon name="eye" />
        </button>
      </div>
      {caps && <p id={capsId} className="hint hint--warn">Caps Lock is on.</p>}
    </>
  );
}

/** Intra logins are lowercase. Accept a pasted 42 email or "@login" and keep just the login. */
export function intraLogin(raw: string): string {
  return raw.trim().toLowerCase().replace(/^@/, '').replace(/@(?:student\.)?42amman\.com$/, '');
}
