import { request } from './http';
import type { Api } from './index';
import type {
  Dashboard, GivenRating, HistoryPoint, Label, Me, Page, Participation, Peer, Profile,
  Stars, SubmitRatingInput, SubmitRatingResult,
} from './types';

export const realApi: Api = {
  login: (intra_username, password) =>
    request<void>('POST', '/auth/login', { intra_username, password, account_type: 'student' }),
  logout: () => request<void>('POST', '/auth/logout'),
  setupRequest: (intra_username) =>
    request<void>('POST', '/auth/setup-request', { intra_username, account_type: 'student' }),
  setupComplete: (token, password) => request<void>('POST', '/auth/setup-complete', { token, password }),

  me: () => request<Me>('GET', '/me'),
  saveProfile: (profile: Profile) => request<Me>('PATCH', '/me/profile', profile),

  dashboard: () => request<Dashboard>('GET', '/student/dashboard'),
  searchPeers: (query: string) =>
    request<Page<Peer>>('GET', '/student/peers?query=' + encodeURIComponent(query)).then((p) => p.items),
  labels: (stars: Stars) =>
    request<Page<Label>>('GET', '/student/labels?stars=' + stars).then((p) => p.items),
  submitRating: (input: SubmitRatingInput, idempotencyKey: string) =>
    request<SubmitRatingResult>('POST', '/student/ratings', input, { 'Idempotency-Key': idempotencyKey }),

  history: () => request<Page<HistoryPoint>>('GET', '/student/history').then((p) => p.items),
  participation: () => request<Participation>('GET', '/student/participation'),
  given: (windowId: string) =>
    request<Page<GivenRating>>('GET', '/student/ratings/given?window_id=' + encodeURIComponent(windowId)).then(
      (p) => p.items,
    ),
};
