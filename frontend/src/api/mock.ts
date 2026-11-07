// In-browser stand-in for the Django API, so the UI can be built and demoed
// before the backend exists. It follows the same rules as docs/planning/voting-rules.md.
import type { Api } from './index';
import {
  ApiError,
  type GivenRating, type Label, type Me, type Peer, type Profile, type Stars,
} from './types';

const KEY = 'fairly-mock-v1';
const DAY = 86_400_000;

const ROSTER: (Peer & { status?: 'pending' })[] = [
  { recipient_id: 'stu_anashwan', first_name: 'Ahmad', last_name: 'Nashwan', intra_username: 'anashwan' },
  { recipient_id: 'stu_lmansour', first_name: 'Lina', last_name: 'Mansour', intra_username: 'lmansour' },
  { recipient_id: 'stu_kqasem', first_name: 'Khaled', last_name: 'Qasem', intra_username: 'kqasem' },
  { recipient_id: 'stu_rhaddad', first_name: 'Rami', last_name: 'Haddad', intra_username: 'rhaddad' },
  { recipient_id: 'stu_sabbadi', first_name: 'Sara', last_name: 'Abbadi', intra_username: 'sabbadi' },
  { recipient_id: 'stu_nterzi', first_name: 'Noor', last_name: 'Terzi', intra_username: 'nterzi' },
  { recipient_id: 'stu_oalkhat', first_name: 'Omar', last_name: 'Alkhatib', intra_username: 'oalkhat' },
  { recipient_id: 'stu_yhamdan', first_name: 'Yara', last_name: 'Hamdan', intra_username: 'yhamdan' },
  { recipient_id: 'stu_mzoubi', first_name: 'Mais', last_name: 'Zoubi', intra_username: 'mzoubi' },
  { recipient_id: 'stu_pending', first_name: 'Pending', last_name: 'Student', intra_username: 'pending', status: 'pending' },
];

// Owner's initial catalog (voting-rules.md). Staff can change it in the real system.
const LABELS: (Label & { stars: Stars[] })[] = [
  { id: 'lbl_helpful', name: 'Helpful', tone: 'positive', stars: [3, 2] },
  { id: 'lbl_teammate', name: 'Good teammate', tone: 'positive', stars: [3, 2] },
  { id: 'lbl_community', name: 'Community contributor', tone: 'positive', stars: [3, 2] },
  { id: 'lbl_respectful', name: 'Respectful', tone: 'positive', stars: [3, 2] },
  { id: 'lbl_unreliable', name: 'Unreliable teammate', tone: 'concern', stars: [2, 1] },
  { id: 'lbl_disruptive', name: 'Disruptive', tone: 'concern', stars: [2, 1] },
  { id: 'lbl_aggressive', name: 'Aggressive behavior', tone: 'flag', stars: [1] },
  { id: 'lbl_disrespectful', name: 'Disrespectful', tone: 'flag', stars: [1] },
  { id: 'lbl_other', name: 'Other', tone: 'flag', stars: [1] },
];

interface State {
  session: string | null;
  profiles: Record<string, Profile>;
  given: (GivenRating & { voter: string })[];
  windowEndsAt: number;
  setupFor?: string; // login of the last setup request, so the demo link knows whose it is
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (s.windowEndsAt > Date.now()) return s;
    }
  } catch {
    /* fall through to a fresh state */
  }
  const fresh: State = {
    session: null,
    profiles: {},
    windowEndsAt: Date.now() + 2 * DAY + 14 * 3_600_000 + 8 * 60_000,
    given: [
      seedGiven('stu_kqasem', 3, 'counted', 1),
      seedGiven('stu_rhaddad', 2, 'counted', 0.5),
    ],
  };
  save(fresh);
  return fresh;
}

function seedGiven(id: string, stars: Stars, state: 'counted', daysAgo: number) {
  const recipient = ROSTER.find((r) => r.recipient_id === id)!;
  return {
    rating_id: 'rt_seed_' + id,
    voter: 'anashwan',
    recipient: strip(recipient),
    stars,
    state,
    submitted_at: new Date(Date.now() - daysAgo * DAY).toISOString(),
  };
}

function strip(p: Peer & { status?: string }): Peer {
  return {
    recipient_id: p.recipient_id,
    first_name: p.first_name,
    last_name: p.last_name,
    intra_username: p.intra_username,
  };
}

function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: the mock still works for this page load */
  }
}

const wait = <T,>(value: T, ms = 260) => new Promise<T>((r) => setTimeout(() => r(value), ms));

function current(s: State) {
  if (!s.session) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in.');
  const user = ROSTER.find((r) => r.intra_username === s.session)!;
  return user;
}

const WINDOW_MIN = 3;
const WINDOW_MAX = 5;

function allowance(s: State, username: string) {
  const used = s.given.filter((g) => g.voter === username).length;
  return { votes_used: used, votes_remaining: Math.max(0, WINDOW_MAX - used) };
}

export const mockApi: Api = {
  async login(username, password) {
    const s = load();
    const user = ROSTER.find((r) => r.intra_username === username.trim().toLowerCase());
    if (!user || !password) {
      await wait(null, 400);
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'That username and password don’t match.');
    }
    s.session = user.intra_username;
    save(s);
    await wait(null, 400);
  },
  async logout() {
    const s = load();
    s.session = null;
    save(s);
    await wait(null, 150);
  },
  async setupRequest(username) {
    const s = load();
    s.setupFor = username;
    save(s);
    await wait(null, 500);
  },
  async setupComplete(token) {
    await wait(null, 500);
    // demo: ?token=expired shows the expired-link screen
    if (!token || token === 'expired') throw new ApiError(400, 'INVALID_TOKEN', 'This link is invalid or has expired.');
    return { intra_username: load().setupFor ?? 'anashwan' };
  },
  async resetRequest(username) {
    return mockApi.setupRequest(username);
  },
  async resetComplete(token, password) {
    return mockApi.setupComplete(token, password);
  },

  async me() {
    const s = load();
    const user = current(s);
    const me: Me = {
      id: user.recipient_id,
      intra_username: user.intra_username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: 'student',
      status: user.status ?? 'active',
      picture_url: null,
      profile: s.profiles[user.intra_username] ?? null,
    };
    return wait(me, 200);
  },
  async saveProfile(profile) {
    const s = load();
    const user = current(s);
    s.profiles[user.intra_username] = profile;
    save(s);
    return mockApi.me();
  },

  async dashboard() {
    const s = load();
    const user = current(s);
    return wait({
      server_time: new Date().toISOString(),
      window: {
        id: 'win_7',
        name: 'Window 7',
        starts_at: new Date(s.windowEndsAt - 5 * DAY).toISOString(),
        ends_at: new Date(s.windowEndsAt).toISOString(),
        state: 'open' as const,
        min_votes: WINDOW_MIN,
        max_votes: WINDOW_MAX,
      },
      own_rating: { average: 2.6, scope: 'all_windows' as const },
      allowance: allowance(s, user.intra_username),
    });
  },
  async searchPeers(query) {
    const s = load();
    const me = current(s);
    const q = query.trim().toLowerCase();
    const items = ROSTER.filter(
      (r) =>
        r.intra_username !== me.intra_username &&
        !r.status &&
        (!q ||
          r.intra_username.includes(q) ||
          r.first_name.toLowerCase().includes(q) ||
          r.last_name.toLowerCase().includes(q)),
    ).map(strip);
    return wait(items, 180);
  },
  async labels(stars) {
    return wait(
      LABELS.filter((l) => l.stars.includes(stars)).map(({ id, name, tone }) => ({ id, name, tone })),
      120,
    );
  },
  async submitRating(input) {
    const s = load();
    const me = current(s);
    await wait(null, 450);
    const al = allowance(s, me.intra_username);
    if (al.votes_remaining <= 0) throw new ApiError(409, 'VOTE_LIMIT_REACHED', 'You’ve used all your votes for this window.');
    if (input.recipient_id === me.recipient_id) throw new ApiError(409, 'SELF_VOTE_NOT_ALLOWED', 'You can’t rate yourself.');
    if (s.given.some((g) => g.voter === me.intra_username && g.recipient.recipient_id === input.recipient_id)) {
      throw new ApiError(409, 'ALREADY_RATED', 'You already rated this student in this window.');
    }
    if (input.stars === 1 && (input.label_ids.length === 0 || !input.explanation?.trim())) {
      throw new ApiError(422, 'INVALID_LABEL_SELECTION', 'A 1-star vote needs a reason and an explanation.');
    }
    const recipient = ROSTER.find((r) => r.recipient_id === input.recipient_id);
    if (!recipient) throw new ApiError(404, 'RECIPIENT_UNAVAILABLE', 'This student isn’t available.');
    const rating = {
      rating_id: 'rt_' + Math.random().toString(36).slice(2, 10),
      voter: me.intra_username,
      recipient: strip(recipient),
      stars: input.stars,
      state: 'counted' as const,
      submitted_at: new Date().toISOString(),
    };
    s.given.push(rating);
    save(s);
    return {
      rating_id: rating.rating_id,
      state: rating.state,
      submitted_at: rating.submitted_at,
      allowance: allowance(s, me.intra_username),
    };
  },

  async history() {
    return wait([
      { window_id: 'win_1', name: 'Window 1', average: null, state: 'closed' as const },
      { window_id: 'win_2', name: 'Window 2', average: 2.2, state: 'closed' as const },
      { window_id: 'win_3', name: 'Window 3', average: 2.4, state: 'closed' as const },
      { window_id: 'win_4', name: 'Window 4', average: null, state: 'closed' as const },
      { window_id: 'win_5', name: 'Window 5', average: 2.3, state: 'closed' as const },
      { window_id: 'win_6', name: 'Window 6', average: 2.6, state: 'closed' as const },
      { window_id: 'win_7', name: 'Window 7', average: null, state: 'open' as const },
    ]);
  },
  async participation() {
    const s = load();
    const me = current(s);
    const used = allowance(s, me.intra_username).votes_used;
    return wait({ streak: 4, windows_joined: 6, windows_total: 7, votes_given_total: 17 + used });
  },
  async given() {
    const s = load();
    const me = current(s);
    return wait(
      s.given
        .filter((g) => g.voter === me.intra_username)
        .map(({ voter: _voter, ...rest }) => rest)
        .reverse(),
      150,
    );
  },
};
