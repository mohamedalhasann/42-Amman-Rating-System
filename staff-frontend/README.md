# Fairly staff frontend

React + Vite, connected to Django through cookie sessions. The bundle contains no demo roster or cases. Workspace records stay in memory and are never saved to localStorage. Fixture/model files remain only for tests.

## Run locally

From the repository root, with the backend environment already configured:

```sh
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py provision_staff
cd staff-frontend
npm install
npm run build
cd ..
.venv/bin/python backend/manage.py runserver
```

Build the shared frontend too: `npm --prefix frontend ci` and `npm --prefix frontend run build` from the repository root. Open **http://127.0.0.1:8000/login**; a staff sign-in opens `/staff/`. The existing superuser can use the shared login or `/admin/`. Use the same hostname throughout. See [full startup](../INTEGRATION.md).

The shared login from `main` is connected. Username/password authentication resolves the stored role and sends staff here; students use onboarding/home. Setup needs only the username. The backend chooses the stored role and email domain. Staff sign-out returns to the shared login.

For React development, keep Django on port 8000 and run `npm run dev` in this directory. Open **http://127.0.0.1:5173/staff/**. Vite proxies `/api` to Django. Port 5173 is fixed; its localhost origins are trusted for CSRF only in Django debug mode. Do not put credentials or API tokens in Vite environment variables.

For production, serve `dist/assets/` at `/staff/assets/` through the web server. Route `/staff/` and `/api/v1/` to Django on the same HTTPS origin. Django serves the built index; its asset route is development-only. Configure real SMTP, PostgreSQL, HTTPS and secrets separately.

## Connected pages

- **Overview:** totals, participation, daily activity and recent ratings for the selected window.
- **Students:** imported student directory and captured-window participation, with search/pagination. Records show given/received histories and all-window/window averages. Private photos render when available, with initials on missing or failed images.
- **Ratings:** group by recipient, stars or label; inspect histories/details; export all matching results rather than just the visible page.
- **Abuse review:** persisted cases, findings, students, ratings and blocked attempts. Select abusive counted ratings first, then resolve once with one reason. The server saves the decision, selected exclusions and audit together. Dismissal preserves ratings.
- **Configuration:** persisted windows and labels, overlap/limit validation, stale-write checks and preserved rosters/history.
- **Accounts:** pending student approvals, versioned manual-approval setting and trusted staff roster with setup status.
- **Activity log:** persisted staff actors/actions, approvals, configuration, case decisions and CSV exports.

Changes show success only after server confirmation. The app refreshes on demand, on focus and every minute while visible. Expired or revoked access removes workspace data. Backend failures never fall back to synthetic records.

## Current boundaries

An empty database shows empty states. Create a window and labels in Configuration. Browse imported students before a window exists. Approvals do not change an already captured roster.

Student submissions now persist to the shared models and appear here after refresh. Automatic abuse detection remains pending: durable jobs are saved, but thresholds and a worker are not enabled. An empty queue does not mean a detector ran. Do not insert demo votes/cases into the real database.

Run `manage.py capture_window_rosters` every minute in deployment; staff reads and window writes also capture overdue rosters. Captures exclude approvals/verification after opening and never replace existing snapshots. Delayed capture uses current activation/eligibility because historical changes are not recorded: run the scheduler at opening. Date edits preserve captured membership.

Staff reads currently fetch one complete campus snapshot, with React search/grouping/pagination. This suits the initial campus integration; large histories will need server aggregation and paginated reads. CSV is server-generated and audited, with at most 10000 selected records per request. PostgreSQL concurrency and production deployment have not been verified locally.

Photo collection remains blocked by the upstream CDN; missing photos use initials. Login and ordinary page requests never call 42.

## Verification

```sh
npm test
npm run build
../.venv/bin/python ../backend/manage.py test profiles.tests --noinput
```

Backend tests cover authorization/CSRF, automatic role lookup, trusted provisioning, imports, account setup/approval, rosters, configuration conflicts, atomic case resolution and CSV safety/auditing. Frontend model tests cover all eight abuse examples and reporting/filtering rules.

Browser checks use an isolated synthetic SQLite database. They cover all seven pages, directory search/pagination/records, grouped rating details, selection before resolution, recalculated totals, CSV, persisted configuration, approvals/settings, audit, refresh, narrow layouts, session expiry and absence of workspace browser storage.

The bundled Space Grotesk/JetBrains Mono fonts retain their original license notices in `src/fonts.css`. Campus branding uses the supplied 42 asset.
