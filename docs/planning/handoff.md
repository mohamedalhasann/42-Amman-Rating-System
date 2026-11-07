# Handoff — final night (8 Nov 2026)

Submission deadline: **Sunday 8 November, 9:00 AM (Amman)**. Commits after that disqualify the team.
Working branch: `feat/staff-redesign` (contains `main`, the student integration and the staff work).

## Remaining, in order

1. **Spec labels.** Add the labels from the spec table (Fair, Thorough, Clear explainer, Helpful feedback,
   Well prepared, Knows their code, Open to feedback; Rushed, Late, Defensive; Bad Evaluator, Unprepared)
   with the right star levels, and map each to a dimension in `staff-frontend/src/insights.js`.
2. **Link everything.** One PR `feat/staff-redesign` → `main`. `feat/home-layout` (desktop home
   experiments) and `feat/pet-cat` are intentionally not included.
3. **PWA** for the student app (`frontend/`): manifest, icons, service worker. Check the CSP in Django allows it.
4. **Profile pictures.** No empty avatars: a cat picture per user, chosen deterministically from the user id.
5. **Mobile test pass** of the student app on a phone viewport, then final fixes.
6. Then: end-to-end check (student votes → detection opens a case → staff decides), demo data.

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
