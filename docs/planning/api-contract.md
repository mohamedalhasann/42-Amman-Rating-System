# Proposed API contract

Status: Profile import, protected profiles, [local accounts](../../backend/ACCOUNTS.md), and the [staff React workspace](../../staff-frontend/README.md) are implemented. The exact connected staff endpoints are listed below; the granular read/write routes later in this document remain proposals. Student submission and automatic detection are not implemented. Shared React login remains on `feat/student-frontend` for later integration.

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
| POST | `/auth/setup-complete` | `token`, `password`. Consume token, create credential, verify email, apply current approval setting. |
| POST | `/auth/login` | `intra_username`, `password`; stored account determines role. Legacy `account_type` is ignored. |
| POST | `/auth/logout` | Authenticated session revocation; CSRF protection if using cookies. |
| GET | `/staff/settings` | Read approval setting and version. |
| PATCH | `/staff/settings` | `manual_student_approval_enabled`, expected `version`; preserve existing approvals. |
| GET | `/staff/account-approvals` | Paginated verified pending student accounts. |
| POST | `/staff/account-approvals/{student_id}/approve` | Record approval of a verified imported student. |

Setup and login are public authentication entry points, not public roster access. Login grants application access only to active, verified, approved accounts. Password-verified pending accounts may receive a restricted pending status; exact session behavior is open. Generic failures must not reveal account existence. Password recovery is not finalized.

## Student routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | Current user's approved display identity and role |
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
  "allowance": { "votes_used": 3, "votes_remaining": 7 }
}
```

If there is no open window, return `window: null` and `allowance: null` while preserving the all-window own average. No counted received ratings means a null average. Never reuse an earlier window's allowance. Proposed baseline: return only an open window; upcoming or closed-window display is optional.

Peer items contain `{ "recipient_id": "student_example", "first_name": "Example", "last_name": "Student", "intra_username": "example" }`. Display the full name and username. Photo display remains proposed; expose only controlled authenticated references if enabled. Label items contain `{ "id": "label_example", "name": "Helpful" }`. Neither collection contains ratings, received labels, provider subjects, or email addresses.

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

Proposed error codes: `WINDOW_CLOSED`, `VOTE_LIMIT_REACHED`, `SELF_VOTE_NOT_ALLOWED`, `ALREADY_RATED`, `INVALID_LABEL_SELECTION`, `RECIPIENT_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`. Text and selection limits remain open. Add specific validation errors for missing 1-star flags or explanation without leaking private records.

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
