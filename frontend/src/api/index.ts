import { mockApi } from './mock';
import { realApi } from './real';
import type {
  Dashboard, GivenRating, HistoryPoint, Label, Me, Participation, Peer, Profile,
  Stars, SubmitRatingInput, SubmitRatingResult,
} from './types';

export interface Api {
  login(intra_username: string, password: string): Promise<void>;
  logout(): Promise<void>;
  setupRequest(intra_username: string): Promise<void>;
  setupComplete(token: string, password: string): Promise<void>;
  me(): Promise<Me>;
  saveProfile(profile: Profile): Promise<Me>;
  dashboard(): Promise<Dashboard>;
  searchPeers(query: string): Promise<Peer[]>;
  labels(stars: Stars): Promise<Label[]>;
  submitRating(input: SubmitRatingInput, idempotencyKey: string): Promise<SubmitRatingResult>;
  history(): Promise<HistoryPoint[]>;
  participation(): Promise<Participation>;
  given(windowId: string): Promise<GivenRating[]>;
}

export const isMock = import.meta.env.VITE_USE_MOCK !== 'false';
export const api: Api = isMock ? mockApi : realApi;
export * from './types';
