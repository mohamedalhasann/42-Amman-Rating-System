# Fairly student frontend

React + TypeScript + Vite. Student experience for PC and mobile: sign in, first-time password setup, onboarding (character and accent color), dashboard, and the rating flow.

## Run it

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173.

- `VITE_USE_MOCK=true` (default): runs entirely in the browser with a mock API. Sign in with any roster username, for example `anashwan`, and any password. Username `pending` shows the waiting-for-approval screen. Mock data lives in `localStorage`; clear it to start over.
- `VITE_USE_MOCK=false`: calls the Django API at `/api/v1`. In development, Vite proxies `/api` to `http://localhost:8000`.

`npm run build` typechecks and builds to `dist/`.

## Structure

| Path | What it holds |
| --- | --- |
| `src/api/types.ts` | Request and response shapes from `docs/planning/api-contract.md` |
| `src/api/real.ts` | Calls to the Django API (session cookie + CSRF token on writes, `Idempotency-Key` on ratings) |
| `src/api/mock.ts` | In-browser mock following `voting-rules.md` |
| `src/session.tsx` | Signed-in user, login/logout, profile save, accent color |
| `src/App.tsx` | Routes and the guard that sends users to login, pending, onboarding or home |
| `src/components/Character.tsx` | The character, built from swappable SVG parts |
| `src/screens/` | Login, setup, pending, onboarding, home, rating sheet |
| `src/styles/` | Design tokens (`global.css`) and screen styles (`screens.css`) |

## Design rules

- Thick ink outlines everywhere, matching the characters. Hard offset shadows only on things you press.
- One accent color, chosen by the student (42 cyan by default), set as `--accent` on the root.
- Space Grotesk for text, JetBrains Mono for usernames, numbers and the timer.
- Students only ever see their own rating, their own votes and the window. Nothing about anyone else.

## Backend endpoints this needs

Besides the routes already in the contract, the frontend uses the additions listed under "Student interface additions" in `docs/planning/api-contract.md`.
