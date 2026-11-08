# Run the connected Fairly application

This branch combines the student/shared-login frontend from `main` with the saved staff/Django work. Both React apps use one Django session and one database. No production record is stored in browser localStorage. The existing imported profiles and provisioned staff remain in the local database.

## Local startup

From the repository root:

Use Node `20.19+` or `22.12+` for the patched Vite toolchain (tested with Node 22.22.2).

```sh
.venv/bin/pip install -r backend/requirements.lock
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py provision_staff
npm --prefix frontend ci
npm --prefix frontend run build
npm --prefix staff-frontend ci
npm --prefix staff-frontend run build
.venv/bin/python backend/manage.py runserver
```

Keep the existing `backend/.env`; do not replace credentials or delete the database. These commands need no 42 API request. Migrations preserve profiles, credentials, approvals and saved staff records. New profiles start with default accent and unfinished onboarding. The approved initial label catalog is inserted without overwriting existing label settings.

Open **http://127.0.0.1:8000/login**. This is the shared login from the student frontend. Staff land at `/staff/`; approved students land at onboarding or `/`. `/admin/` remains available for the existing superuser. Use the same hostname for every page, since `localhost` and `127.0.0.1` have separate cookies.

For first-time setup, use `/setup`. The backend looks up the stored role and sends only to `{username}@42amman.com` for provisioned staff or `{username}@student.42amman.com` for eligible imported students. In local console-mail mode, open the link printed in the Django terminal; no external email is sent. Real email delivery requires SMTP configuration. Passwords are never imported or emailed.

The five supplied staff usernames are `jsukkari`, `malhaimo`, `mosalim`, `abeleima` and `daomar`. Provisioning alone creates neither a usable password nor verified mailbox ownership. Staff setup does not grant Django superuser privileges.

## Student approval and voting

### Local hackathon presentation

Set `LOCAL_DEMO_LOGIN=true` in the ignored `backend/.env`, keep `DJANGO_DEBUG=true`,
restart Django, and rebuild the student frontend after source changes. The existing
shared login then asks only for an Intra username. Only existing active eligible
students and previously provisioned staff can sign in; roles come from the database.
There is no API request, account creation, mailbox check or approval step at login.
Demo sessions do not overwrite passwords, verification timestamps or approval records.

New voting-window snapshots in this mode include all active eligible students,
including those without verification or approval. Existing captured rosters stay
unchanged; create a fresh window after importing/creating the demo participants.
Votes and roster snapshots still persist in the local database.

Set `LOCAL_DEMO_LOGIN=false` and restart Django to restore normal authentication.
Existing demo sessions then lose access and must sign in normally. This option is
disabled outside Django debug mode; use it only for the local presentation.

1. A student verifies their campus mailbox and sets a password through the setup link.
2. With manual approval enabled, signing in shows only the waiting screen. The 15-minute pending session can read its own display identity; dashboard, peers, photos, preferences, voting and all staff routes remain blocked.
3. Staff approve the verified account from **Accounts**. The student's **Check again** action then opens onboarding.
4. Create a future voting window after the intended participants are approved. The opening snapshot includes only students eligible, active, verified and approved at opening. Newly approved students join a future window; approval does not change a captured roster.
5. Students submit 1–3 stars and allowed labels. One star requires a label and explanation. All accepted votes count immediately, and appear in the staff workspace after refresh.

Run `manage.py capture_window_rosters` every minute in deployment. Student/staff reads also capture overdue windows, using current eligibility and activation plus verification/approval timestamps. A delayed capture cannot reconstruct past activation changes.

The server validates role, current activation/eligibility, dates, voter/recipient membership, self-votes, pair uniqueness, allowance and label mappings. Retries reuse an idempotency key; a changed payload under that key fails. Invalidated votes continue to consume allowance and cannot be resubmitted for the same pair/window.

Students see only their own average and their own given-vote records. The history is their cumulative currently-counted average up to each closed window's end; later staff invalidations affect recalculation. No campus-average substitute or minimum-rater publication threshold is enabled. Those behaviors in the original prototype were proposals conflicting with the agreed immediate-counting/own-score rules.

## Development and deployment

For student React development, keep Django on port 8000 and run `npm --prefix frontend run dev`. Open `http://127.0.0.1:5173`; `/api` and `/staff` proxy to Django. Build the staff app first. For staff-only React development, stop the student Vite server and run `npm --prefix staff-frontend run dev`, opening `/staff/` on port 5173. The fixed port has debug-only trusted CSRF origins.

The student app uses the real API by default. Explicit `VITE_USE_MOCK=true` enables isolated development mocks only; production builds always use the backend. Real requests never fall back to mock data. Setup/reset tokens are read from fragments, removed from the address bar and retained only in memory until submission; reopening the email link is needed after refreshing a completion page.

In production, serve `frontend/dist/assets/` at `/assets/` and `staff-frontend/dist/assets/` at `/staff/assets/`. Route the app pages and `/api/v1/` to Django on the same HTTPS origin. Django's asset routes are debug-only. Configure trusted hosts/origin, SMTP, PostgreSQL, secure cookies and the roster scheduler separately.

## Verification and remaining work

```sh
.venv/bin/python backend/manage.py test profiles.tests --noinput
npm --prefix frontend run build
npm --prefix staff-frontend test
npm --prefix staff-frontend run build
```

71 Django tests and 13 staff model tests cover imports, access, setup/reset, approvals, profiles, rosters, submission, idempotency, invalidation, configuration and export. Browser checks use a disposable synthetic database and captured local test emails: shared role routing, both setup domains, token removal, waiting/approval, onboarding, accent persistence, late membership, pagination/search, serious-vote submission visible to staff, password recovery, role isolation and mobile layouts.

Accepted submissions and blocked self/duplicate/limit attempts enqueue durable `DetectionJob` records. **Automatic detection is not running**: observation intervals, thresholds and a worker remain deferred. An empty abuse queue does not prove a detector ran. Photo downloads remain blocked upstream; saved private photos are supported and missing/failed images use initials. PostgreSQL concurrency and production SMTP/deployment have not been verified in this local run.
