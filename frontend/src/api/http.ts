import { ApiError } from './types';

const BASE = '/api/v1';
let csrfRequest: Promise<string> | null = null;
let credentialGeneration=0;

async function csrfToken(): Promise<string> {
  if(!csrfRequest)csrfRequest=fetch(BASE+'/auth/csrf',{credentials:'same-origin',cache:'no-store'})
    .then(async response=>{
      if(!response.ok)throw new ApiError(response.status,'CSRF_FAILED','Could not prepare this request. Try again.');
      return (await response.json()).csrf_token as string;
    }).catch(error=>{csrfRequest=null;throw error;});
  return csrfRequest;
}

// Django session auth: cookies are sent with every request, and writes carry the CSRF token.
export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const credential=credentialGeneration;
  const headers: Record<string, string> = { Accept: 'application/json', ...extraHeaders };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    headers['X-CSRFToken'] = await csrfToken();
  }

  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach the server. Check your connection.');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    if(err?.code==='CSRF_FAILED')csrfRequest=null;
    if(credential===credentialGeneration&&(res.status===401||(res.status===403&&['ACCESS_DENIED','FORBIDDEN'].includes(err?.code)))&&!path.startsWith('/auth/')) {
      window.dispatchEvent(new Event('fairly:session-ended'));
    }
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Something went wrong.');
  }
  if(data?.csrf_token)csrfRequest=Promise.resolve(data.csrf_token);
  if(['/auth/login','/auth/logout','/auth/password-reset-complete'].includes(path))++credentialGeneration;
  if(path==='/auth/logout'||path==='/auth/password-reset-complete')csrfRequest=null;
  if(path==='/auth/password-reset-complete')window.dispatchEvent(new Event('fairly:session-ended'));
  return data as T;
}
