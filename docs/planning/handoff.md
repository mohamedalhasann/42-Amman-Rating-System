# Handoff — final night (8 Nov 2026)

Submission deadline: **Sunday 8 November, 9:00 AM (Amman)**. Commits after that disqualify the team.
Working branch: `feat/staff-redesign` (contains `main`, the student integration and the staff work).

## Status

Done: spec labels, PWA, cat avatars, readable CSV, too-fast detection, mobile check of the student flow,
end-to-end (student votes 1★ on a phone → detection opens the check → staff decide).
Open: **PR #5 `feat/staff-redesign` → `main` must be merged before 9:00.** `feat/home-layout` and
`feat/pet-cat` are intentionally not included.

## How to run locally

- `cd staff-frontend && npm run build`, `cd frontend && npm run build` (Django serves both builds).
- `.venv/bin/python backend/manage.py runserver 127.0.0.1:8000`, sign in at `/login`.
- `.venv/bin/python backend/manage.py scan_abuse` re-runs detection over every window.
- Tests: `.venv/bin/python backend/manage.py test profiles`, `cd staff-frontend && npm test`.

## Abuse detection, in one paragraph

`backend/profiles/detection.py` ports Abdalhadi's rules (bulk, repeated, group, pair, boosting, extreme,
1-star check) with his thresholds, plus two of ours: **too fast** (4+ votes in 120 s, all the same stars;
speed alone is never flagged) and **refused attempts** (2+ refused votes, context only). It runs after
every vote commits and never affects the student. Staff see cases in three lanes: likely abuse,
1-star checks, for context.

## Known notes for the team

- Abdalhadi's repeated-votes rule compares the last two votes, not strictly consecutive windows, and
  flags repeated 3★ between friends (most "likely abuse" cases in demo data).
- The voting endpoint has no request throttle; refused votes are harmless but not rate-limited.
- Narrow (phone) layout of the staff app is rough; the staff app is a PC experience per the spec.
