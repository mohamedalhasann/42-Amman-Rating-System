// Shapes follow docs/planning/api-contract.md.
// Fields marked "added" are proposed additions documented in that file.

export type Stars = 1 | 2 | 3;

// added: saved by PATCH /me/profile
export interface Profile {
  accent: string;
  onboarded: boolean;
}

export interface Me {
  id: string;
  intra_username: string;
  first_name: string;
  last_name: string;
  role: 'student' | 'staff';
  status: 'active' | 'pending'; // added
  picture_url: string | null;
  profile: Profile | null; // added
}

export interface VotingWindow {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  state: 'open';
  min_votes: number;
  max_votes: number;
}

export interface Dashboard {
  server_time: string;
  window: VotingWindow | null;
  own_rating: { average: number | null; scope: 'all_windows' };
  campus_average: number | null; // added: mean of every student's all-window average
  allowance: { votes_used: number; votes_remaining: number } | null;
}

export interface Peer {
  recipient_id: string;
  first_name: string;
  last_name: string;
  intra_username: string;
}

export interface Label {
  id: string;
  name: string;
  tone: 'positive' | 'concern' | 'flag'; // added: lets the UI style labels by meaning
}

export interface SubmitRatingInput {
  window_id: string;
  recipient_id: string;
  stars: Stars;
  label_ids: string[];
  explanation?: string;
}

export interface SubmitRatingResult {
  rating_id: string;
  state: 'counted';
  submitted_at: string;
  allowance: { votes_used: number; votes_remaining: number };
}

// added: GET /student/history
export interface HistoryPoint {
  window_id: string;
  name: string;
  average: number | null; // null when the window had too few raters
  state: 'closed' | 'open';
}

// added: GET /student/participation
export interface Participation {
  streak: number;
  windows_joined: number;
  windows_total: number;
  votes_given_total: number;
}

// added: GET /student/ratings/given?window_id=
export interface GivenRating {
  rating_id: string;
  recipient: Peer;
  stars: Stars;
  state: 'counted' | 'invalidated'; // invalidated: staff confirmed abuse
  submitted_at: string;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
