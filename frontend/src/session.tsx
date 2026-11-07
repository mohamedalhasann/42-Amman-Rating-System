import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, type Me, type Profile } from './api';

import { DEFAULT_ACCENT, applyAccent, knownAccent } from './accents';

export { DEFAULT_ACCENT, applyAccent };

type Status = 'loading' | 'anonymous' | 'ready' | 'error';

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
  const generation=useRef(0),refreshSequence=useRef(0),authenticating=useRef(false),profileQueue=useRef<Promise<void>>(Promise.resolve());

  const refresh = useCallback(async () => {
    if(authenticating.current)return null;
    const current=generation.current,sequence=++refreshSequence.current;
    try {
      const next = await api.me();
      if(current!==generation.current||sequence!==refreshSequence.current)return null;
      setMe(next);
      setStatus('ready');
      applyAccent(knownAccent(next.profile?.accent));
      return next;
    } catch (e) {
      if(current!==generation.current||sequence!==refreshSequence.current)return null;
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setMe(null);
        setStatus('anonymous');
        applyAccent(DEFAULT_ACCENT);
        return null;
      }
      setStatus('error');
      throw e;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    const ended=()=>{++generation.current;setMe(null);setStatus('anonymous');applyAccent(DEFAULT_ACCENT);};
    const focused=()=>{refresh().catch(()=>undefined);};
    window.addEventListener('fairly:session-ended',ended);
    window.addEventListener('focus',focused);
    return()=>{++generation.current;window.removeEventListener('fairly:session-ended',ended);window.removeEventListener('focus',focused);};
  }, [refresh]);

  const value: SessionValue = {
    status,
    me,
    refresh,
    async login(username, password) {
      authenticating.current=true;++generation.current;
      try{await api.login(username,password);}finally{authenticating.current=false;}
      return refresh();
    },
    async logout() {
      authenticating.current=true;++generation.current;
      try{await api.logout();}finally{authenticating.current=false;}
      ++generation.current;
      setMe(null);
      setStatus('anonymous');
      applyAccent(DEFAULT_ACCENT);
    },
    async saveProfile(profile) {
      const current=generation.current;
      const task=profileQueue.current.catch(()=>undefined).then(async()=>{
        if(current!==generation.current)return;
        const next=await api.saveProfile(profile);
        if(current===generation.current){++refreshSequence.current;setMe(next);applyAccent(profile.accent);}
      });
      profileQueue.current=task;
      return task;
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
