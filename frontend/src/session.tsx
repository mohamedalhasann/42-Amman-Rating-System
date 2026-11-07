import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type Me, type Profile } from './api';

import { DEFAULT_ACCENT, applyAccent, knownAccent } from './accents';

export { DEFAULT_ACCENT, applyAccent };

type Status = 'loading' | 'anonymous' | 'ready';

interface SessionValue {
  status: Status;
  me: Me | null;
  refresh(): Promise<Me | null>;
  login(username: string, password: string): Promise<Me | null>;
  logout(): Promise<void>;
  saveProfile(profile: Profile): Promise<void>;
  previewAccent(color: string): void;
}

const SessionContext = createContext<SessionValue | null>(null);


export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await api.me();
      setMe(next);
      setStatus('ready');
      applyAccent(knownAccent(next.profile?.accent));
      return next;
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setMe(null);
        setStatus('anonymous');
        applyAccent(DEFAULT_ACCENT);
        return null;
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => setStatus('anonymous'));
  }, [refresh]);

  const value: SessionValue = {
    status,
    me,
    refresh,
    async login(username, password) {
      await api.login(username, password);
      return refresh();
    },
    async logout() {
      await api.logout();
      setMe(null);
      setStatus('anonymous');
      applyAccent(DEFAULT_ACCENT);
    },
    async saveProfile(profile) {
      const next = await api.saveProfile(profile);
      setMe(next);
      applyAccent(profile.accent);
    },
    previewAccent: applyAccent,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
