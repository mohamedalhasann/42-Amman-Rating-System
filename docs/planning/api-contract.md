# Proposed API contract

Status: Framework-independent draft for team review. Routes and shapes are proposals, not implemented endpoints. Policy-dependent responses assume the defaults in [decisions](decisions.md).

## Shared conventions

- Base path: `/api/v1`. JSON requests and responses, except CSV downloads.
- Authentication mechanism is pending D02. Every route below requires authentication. Staff routes also require a server-verified staff role.
- IDs are opaque strings. Timestamps use ISO 8601 UTC. Include server time in student dashboard responses.
- Collections return `{ "items": [], "next_cursor": null }`. Proposed default limit: 25, maximum: 100. Reject invalid limits and unsupported filters.
- Error shape: `{ "error": { "code": "WINDOW_CLOSED", "message": "Voting has closed." } }`.
- Status codes: `400` malformed input, `401` unauthenticated, `403` forbidden, `404` unavailable resource, `409` state conflict or duplicate, `422` invalid field values, `429` rate limit. Do not leak private resource existence through errors.
- Student requests must never accept a caller-supplied voter ID or role. Use explicit response fields rather than serializing whole database records.

## Student routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | Current user's approved display identity and role |
| GET | `/student/dashboard` | Own average, current window, allowance, and server time |
| GET | `/student/peers?query=...&cursor=...` | Minimal approved recipient directory, pending D13 |
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
  "own_rating": { "average": 2.5, "scope": "current_window" },
  "allowance": { "votes_used": 3, "votes_remaining": 7 }
}
```

If there is no current window, return `window: null`, `allowance: null`, and `own_rating: { "average": null, "scope": "current_window" }` under the current-window proposal. Never reuse an earlier window's allowance. Window state is `upcoming`, `open`, or `closed`; decide whether the dashboard should select an upcoming or most recent closed window before implementing that display.

Peer items contain only `{ "recipient_id": "student_example", "display_name": "Example Student" }`. Label items contain `{ "id": "label_example", "name": "Helpful" }`. Neither collection contains ratings, received labels, provider subjects, or email addresses.

Submission body:

```json
{
  "window_id": "window_example",
  "recipient_id": "student_example",
  "stars": 3,
  "label_ids": ["label_example"]
}
```

Optional `explanation` remains pending D14. A first submission returns `201` with `{ "rating_id": "rating_example", "submitted_at": "2026-11-04T10:00:00Z", "allowance": { "votes_used": 4, "votes_remaining": 6 } }`. An identical retry returns `200`. No recipient statistics are included.

Proposed error codes: `WINDOW_CLOSED`, `VOTE_LIMIT_REACHED`, `SELF_VOTE_NOT_ALLOWED`, `ALREADY_RATED`, `INVALID_LABEL_SELECTION`, `RECIPIENT_UNAVAILABLE`, `IDEMPOTENCY_CONFLICT`. Codes tied to open policies become final only after those policies are agreed.

## Staff read routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/staff/overview?window_id=...` | `ratings_submitted`, `ratings_valid`, `ratings_invalidated`, `students_total`, `students_rated`, `students_not_rated` |
| GET | `/staff/participation?window_id=...&participation=all` | Student identity, votes submitted, valid votes given, minimum progress; filter `all`, `rated`, or `not_rated` |
| GET | `/staff/students?query=...` | Staff student lookup |
| GET | `/staff/students/{id}?window_id=...` | Student identity and average with explicit scope |
| GET | `/staff/students/{id}/ratings?window_id=...&direction=received` | Paginated `received` or `given` votes with identities, stars, labels, and validity |
| GET | `/staff/ratings?window_id=...` | Paginated vote records; optional student, stars, label, and validity filters |
| GET | `/staff/rating-groups?window_id=...&group_by=label` | Group by `label`, `stars`, or `student` |
| GET | `/staff/labels` | Active and inactive labels with allowed stars |
| GET | `/staff/windows` | Window configuration and versions |
| GET | `/staff/abuse-cases?status=open` | Unified case queue with summaries, mechanisms, and involved students |
| GET | `/staff/abuse-cases/{id}` | Findings, evidence, linked votes, and review decision |
| GET | `/staff/ratings/export.csv?window_id=...` | Staff-only CSV export |

All list routes follow collection pagination. Window-scoped analytics require `window_id`; do not silently mix windows. Rating lists default to all validity states with an explicit `validity` field. Group responses include separate submitted and valid counts. A student grouping is by recipient; label grouping may count the same vote under several labels.

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

Columns: `rating_id`, `window_id`, `voter_id`, `voter_name`, `recipient_id`, `recipient_name`, `stars`, `labels`, `submitted_at`, `validity`, `invalidation_reason`. Confirm identifying columns with staff. Quote values correctly, escape embedded quotes and separators, and neutralize spreadsheet formula prefixes in user-controlled cells. Record export access and prevent public caching.
