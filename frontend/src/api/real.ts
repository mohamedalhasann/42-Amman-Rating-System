import { request } from './http';
import type { Api } from './index';
import type {
  Dashboard, GivenRating, HistoryPoint, Label, Me, Page, Participation, Peer, Profile,
  Stars, SubmitRatingInput, SubmitRatingResult,
} from './types';

export const realApi: Api = {
  login: (intra_username, password) =>
    request<void>('POST', '/auth/login', { intra_username, password }),
  logout: () => request<void>('POST', '/auth/logout'),
  setupRequest: (intra_username) =>
    request<void>('POST', '/auth/setup-request', { intra_username }),
  setupComplete: (token, password) =>
    request<{ intra_username?: string } | undefined>('POST', '/auth/setup-complete', { token, password }),
  resetRequest: (intra_username) =>
    request<void>('POST', '/auth/password-reset-request', { intra_username }),
  resetComplete: (token, password) =>
    request<{ intra_username?: string } | undefined>('POST', '/auth/password-reset-complete', { token, password }),

  me: () => request<Me>('GET', '/me'),
  saveProfile: (profile: Profile) => request<Me>('PATCH', '/me/profile', profile),

  dashboard: () => request<Dashboard>('GET', '/student/dashboard'),
  searchPeers: (query: string, cursor?: string) =>
    request<Page<Peer>>('GET', '/student/peers?limit=25&query=' + encodeURIComponent(query)+(cursor?'&cursor='+encodeURIComponent(cursor):'')),
  labels: (stars: Stars) =>
    collection<Label>('/student/labels?stars=' + stars),
  submitRating: (input: SubmitRatingInput, idempotencyKey: string) =>
    request<SubmitRatingResult>('POST', '/student/ratings', input, { 'Idempotency-Key': idempotencyKey }),

  history: () => collection<HistoryPoint>('/student/history'),
  participation: () => request<Participation>('GET', '/student/participation'),
  given: (windowId: string) =>
    collection<GivenRating>('/student/ratings/given?window_id=' + encodeURIComponent(windowId)),
};

async function collection<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page: Page<T> = await request('GET', path+(path.includes('?')?'&':'?')+'limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
    items.push(...page.items);
    cursor = page.next_cursor;
    if(cursor && seen.has(cursor))throw new Error('Repeated collection cursor.');
    if(cursor)seen.add(cursor);
  } while(cursor);
  return items;
}
