# Fairly student frontend and shared login

React + TypeScript + Vite. The existing screens from `main` are connected to Django: shared sign-in, student/staff setup, password reset, approval waiting, onboarding/accent preferences, student dashboard, history, peers and rating submission.

See [connected app startup and policies](../INTEGRATION.md). For the simplest local setup, build both apps and open **http://127.0.0.1:8000/login** with Django running. Staff go to `/staff/` based on their stored backend role. There is no role selector or separate staff login.

## React development

```sh
cd frontend
npm ci
npm run dev
```

Keep Django on port 8000, then open **http://127.0.0.1:5173**. Vite proxies `/api` and `/staff` to Django; build `staff-frontend` first. Both frontends share this hostname's session cookie. Port 5173 is fixed. Do not run both Vite servers on that port simultaneously.

Real API is the default. `VITE_USE_MOCK=true` explicitly enables development-only mock data; production builds always use the backend. Real sessions, records, passwords and tokens are never written to localStorage or replaced by synthetic fallback data.

```sh
npm run typecheck
npm run build
```

TypeScript checks and the production build are required. Router and Vite dependencies were updated to address the advisories from the original lockfile.

## Integration behavior

- Setup and reset requests send only the Intra username. The server derives the staff/student delivery domain. The generic confirmation does not expose the stored role or claim a student address for staff.
- Completion links use fragments. Tokens are removed from the address bar before API requests and held only in memory. Reopen the email link after a refresh. Password recovery preserves approval/verification and invalidates existing sessions.
- Pending accounts get a short session restricted to their own display identity and waiting screen. Staff approval unlocks onboarding; every student/staff data request rechecks access.
- Accent/onboarding preferences persist in the database. Saved private photos display with initials as fallback. The initial catalog follows `docs/planning/voting-rules.md`.
- The dashboard uses server time and actual allowance. Students outside the opening roster see a clear message and no vote action.
- Peer search includes pagination. Allowed labels come from staff configuration. A one-star vote needs a permitted flag and explanation. Submission uses a stable idempotency key for identical retries; success appears only after the server accepts it.
- Students see their own all-window counted average, own cumulative history and own given votes. No other student's score/received labels, campus-score substitute or minimum-rater threshold is exposed.
- Accepted votes appear in the staff app after refresh. Staff invalidation updates averages and preserves consumed allowance.

The visual design, color choices and existing React screens are retained. Copy about score timing and campus averages now follows the agreed requirements. Automatic detection remains pending; the backend records durable work for it.

Browser verification with synthetic data covers both role routes, setup domains, approval, onboarding, preferences, roster restrictions, peer pagination/search, serious submissions visible to staff, password reset, mobile layout and absence of mock browser storage.
