# Proposed API contract

Status: Profile import, [shared accounts/recovery](../../backend/ACCOUNTS.md), both React clients and student submission are implemented. See [run instructions](../../INTEGRATION.md). Connected staff endpoints are listed below; the granular staff routes later remain proposals. Automatic detection thresholds and worker remain pending; accepted votes and blocked attempts persist durable detection jobs.

## Implemented staff React contract

Every endpoint below requires a trusted, active, verified, approved staff session; writes require CSRF.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/staff/workspace` | Complete campus snapshot: `schema: 4`, workspace `version`, `server_time`, students (identity, activity, verification, approval), staff, windows/rosters, labels, ratings, cases/findings/decisions, attempts, settings/version and staff audit. No credentials, emails or provider IDs. |
| POST | `/staff/actions` | Expected workspace `version` plus `type`: `window`, `label`, or `resolve-case`. Returns the saved snapshot. Window/label use `value` including ID and entity version. Case resolution uses `id`, `status`, `ids` (selected counted evidence) and `reason`. One transaction saves case, exclusions and audit. Stale writes return 409. |
| POST | `/staff/ratings/export.csv` | `window_id`, `rating_ids` (1–10000); validates window/evidence scope, returns formula-safe CSV and records export audit. |

The React app also uses the existing settings and account-approval routes below. It groups/searches/pages the complete snapshot in memory and never stores it in localStorage. Empty data remains empty. Pagination/aggregation routes below are a future scale improvement, not existing endpoints. Capture due rosters through `manage.py capture_window_rosters` on a scheduler; reads and window writes also perform a fallback capture.

## Shared conventions

- Base path: `/api/v1`. JSON requests and responses, except CSV downloads.
- Username/password authentication follows authentication.md. Proposed transport: server-side cookie sessions. Public authentication entry routes are listed below. Application routes require active, verified, approved accounts; staff routes also require a trusted staff role.
- IDs are opaque strings. Timestamps use ISO 8601 UTC. Include server time in student dashboard responses.
- Collections return `{ "items": [], "next_cursor": null }`. Proposed default limit: 25, maximum: 100. Reject invalid limits and unsupported filters.
- Error shape: `{ "error": { "code": "WINDOW_CLOSED", "message": "Voting has closed." } }`.
- Status codes: `400` malformed input, `401` unauthenticated, `403` forbidden, `404` unavailable resource, `409` state conflict or duplicate, `422` invalid field values, `429` rate limit. Do not leak private resource existence through errors.
- Student requests must never accept a caller-supplied voter ID or role. Use explicit response fields rather than serializing whole database records.

## Authentication and account administration

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/setup-request` | `intra_username`. Generic `202`; stored role determines domain. Only eligible provisioned accounts without passwords receive links. |
| POST | `/auth/setup-complete` | `token`, `password`. Consume setup token, create credential, verify email, apply current approval setting. |
| POST | `/auth/password-reset-request` | `intra_username`. Generic `202`; email a purpose-bound reset link only to an eligible account with a password. |
| POST | `/auth/password-reset-complete` | `token`, `password`. Consume reset token, replace credential, revoke sessions. Preserve verification and approval. |
| POST | `/auth/login` | `intra_username`, `password`; stored account determines role. Legacy `account_type` is ignored. |
| POST | `/auth/logout` | Authenticated session revocation; CSRF protection if using cookies. |
| GET | `/staff/settings` | Read approval setting and version. |
| PATCH | `/staff/settings` | `manual_student_approval_enabled`, expected `version`; preserve existing approvals. |
| GET | `/staff/account-approvals` | Paginated verified pending student accounts. |
| POST | `/staff/account-approvals/{student_id}/approve` | Record approval of a verified imported student. |

Setup/login/recovery are public authentication entry points. Password-verified pending students get a 15-minute restricted session: only their own identity/status through `/me` and logout; student/staff data stays blocked. Approved sign-ins last eight hours. Generic failures do not disclose account existence. Setup/reset use separate purpose-bound, hashed, expiring single-use tokens. Recovery preserves verification/approval and invalidates old sessions. Fragment links open the shared React completion pages.

## Student routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | Own display identity, role, active/pending status, private picture reference and own preferences |
| GET | `/student/dashboard` | Own average, current window, allowance, and server time |
| GET | `/student/peers?query=...&cursor=...` | Search eligible peers by first name, last name, or Intra username |
| GET | `/student/labels?stars=3` | Active labels permitted for a selected star level |
| POST | `/student/ratings` | Submit a rating with an `Idempotency-Key` header |

Proposed dashboard response. Values are illustrative, not approved limits:

```json
{
  "server_time": "2026-11-04T10:00:00Z",
  "window": {
    "id": "window_example",
    "name": "Example window",
    "starts_at": "2026-11-03T06:00:00Z",
    "ends_at": "2026-11-07T18:00:00Z",
    "state": "open",
    "min_votes": 2,
    "max_votes": 10
  },
  "own_rating": { "average": 2.5, "scope": "all_windows" },
  "allowance": { "votes_used": 3, "votes_remaining": 7 },
  "voting_notice": null
}
```

No campus average is returned. Students see only their own average. An approved student outside the current opening roster gets the window context, `allowance: null` and an explanatory `voting_notice`; submission remains blocked. This prevents showing an ineligible account as having used every vote.

If there is no open window, return `window: null` and `allowance: null` while preserving the all-window own average. No counted received ratings means a null average. Never reuse an earlier window's allowance. Proposed baseline: return only an open window; upcoming or closed-window display is optional.

Peer items contain `recipient_id`, `first_name`, `last_name`, `intra_username` and `picture_url` (protected reference or null). Only current eligible approved opening-roster peers are returned; self is excluded. Label items contain `id`, `name`, `tone`. Neither collection exposes scores, received labels, provider IDs or emails. UUID cursors and limits from 1–100 are supported.

Submission body:

```json
{
  "window_id": "window_example",
  "recipient_id": "student_example",
  "stars": 3,
  "label_ids": ["label_example"]
}
```

`explanation` is required and nonblank for 1 star, optional for 2 and 3. A 1-star request needs at least one permitted flag ID. A 3-star request can use an empty label list; proposed same for 2 stars. All accepted submissions count immediately, returning `201` with `{ "rating_id": "rating_example", "state": "counted", "submitted_at": "2026-11-04T10:00:00Z", "allowance": { "votes_used": 4, "votes_remaining": 6 } }`. An identical retry returns `200`. No recipient statistics are included.

Implemented errors include `WINDOW_CLOSED`, `VOTER_UNAVAILABLE`, `VOTE_LIMIT_REACHED`, `SELF_VOTE_NOT_ALLOWED`, `ALREADY_RATED`, `INVALID_LABEL_SELECTION`, `RECIPIENT_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`. The idempotency header is a UUID. Payload permits at most 100 distinct label IDs and a 1000-character explanation. Invalid labels and missing one-star context return 422. Self/pair/limit blocks persist evidence and detection jobs; identical accepted retries create neither another rating nor an abuse attempt. A retry after invalidation reports its current invalidated state and preserved consumed allowance.

## Implemented student interface additions

The student frontend uses these additions through the real API by default. Preferences and student data require approval; `/me` is the limited exception for pending users.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | `status` (`active`/`pending`), `picture_url` and `profile: {accent,onboarded}`. Pending/staff preferences are null; approved student defaults use `onboarded: false`. Legacy `photo_url` remains for staff compatibility. |
| PATCH | `/me/profile` | Save `{ "accent": "#00CED1", "onboarded": true }`. Returns the updated `/me`. Validate `accent` against the six allowed colors |
| GET | `/student/labels?stars=3` | Active permitted labels; tone derives from availability: includes 3 → positive, otherwise includes 2 → concern, otherwise flag. |
| GET | `/student/history` | Own cumulative currently-counted average up to each closed window's end, oldest first; only windows in the student's roster history. `average: null` before any counted received ratings and for an open window. Later staff invalidations affect recalculation. No minimum-rater threshold or campus substitute. Cursor pagination supported. |
| GET | `/student/participation` | `{ "streak", "windows_joined", "windows_total", "votes_given_total" }`. `streak` counts consecutive closed windows, ending with the latest, where the student reached that window's minimum |
| GET | `/student/ratings/given?window_id=...` | The student's own submissions in that window: `rating_id`, `recipient` (peer item), `stars`, `state`, `submitted_at`. Never includes other students' ratings or anything the student received |

Allowed accents: `#00CED1`, `#5BA4FF`, `#FF6EC7`, `#24387A`, `#EF4444`, `#B79CF2`.

Onboarding cannot be reset to false after completion. Given-vote records are limited to the session's voter and include no received records or received-label data. Participation counts accepted votes, including invalidated ones; a streak requires at least one submission and meeting the window minimum.

## Staff read routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/staff/overview?window_id=...` | `ratings_submitted`, `ratings_counted`, `ratings_invalidated`, `students_total`, `students_rated`, `students_not_rated` |
| GET | `/staff/participation?window_id=...&participation=all` | Student identity, submitted and counted votes given, minimum progress; filter `all`, `rated`, or `not_rated` |
| GET | `/staff/students?query=...` | Staff student lookup |
| GET | `/staff/students/{id}?window_id=...` | Student identity and average with explicit scope |
| GET | `/staff/students/{id}/ratings?window_id=...&direction=received` | Paginated `received` or `given` votes with identities, stars, labels, and review state |
| GET | `/staff/ratings?window_id=...` | Paginated vote records; optional student, stars, label, and review-state filters |
| GET | `/staff/rating-groups?window_id=...&group_by=label` | Group by `label`, `stars`, or `student` |
| GET | `/staff/labels` | Active and inactive labels with allowed stars |
| GET | `/staff/windows` | Window configuration and versions |

| GET | `/staff/abuse-cases?status=open` | Unified case queue with summaries, mechanisms, and involved students |
| GET | `/staff/abuse-cases/{id}` | Findings, evidence, linked votes, and review decision |
| GET | `/staff/ratings/export.csv?window_id=...` | Staff-only CSV export |

All list routes follow collection pagination. Window-scoped analytics require `window_id`; do not silently mix windows. Rating lists default to all review states with an explicit `state`: `counted` or `invalidated`. Group responses include separate submitted and counted counts. Staff window filters never change the all-window student dashboard average. A student grouping is by recipient; label grouping may count the same vote under several labels.

Before frontend implementation, agree example payloads for staff detail and grouped views using the model field names. This document defines their minimum contents, but does not claim every screen payload is finalized.

## Staff write routes

| Method | Path | Request fields |
| --- | --- | --- |
| POST | `/staff/labels` | `name`, `allowed_stars` |
| PATCH | `/staff/labels/{id}` | `active`, `allowed_stars`; renaming uses replacement under the proposed policy |
| POST | `/staff/windows` | `name`, `starts_at`, `ends_at`, `min_votes`, `max_votes`; roster sourced under D10 |
| PATCH | `/staff/windows/{id}` | Changed configuration fields and expected `version` |

| PATCH | `/staff/abuse-cases/{id}` | `status` (`confirmed` or `dismissed`), `review_reason` |
| POST | `/staff/ratings/{id}/invalidation` | Confirmed `case_id`, `reason` |

Creation returns `201`; updates return `200` with the updated staff representation. Repeated invalidation returns the existing decision without a second effect. Stale configuration or incompatible review state returns `409`. Every control validates role, body, relationships, and current state on the server.

## CSV contract proposal

Columns: `rating_id`, `window_id`, `voter_id`, `voter_name`, `recipient_id`, `recipient_name`, `stars`, `labels`, `submitted_at`, `state`, `explanation`, `invalidation_reason`. Confirm identifying columns with staff. Quote values correctly, escape embedded quotes and separators, and neutralize spreadsheet formula prefixes in user-controlled cells. Record export access and prevent public caching.
