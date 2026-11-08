# Deploying Fairly for free (Render)

One free Render web service runs Django with both built apps, plus one free Render PostgreSQL database.
Everything is described in `render.yaml`; the build runs `bin/render-build.sh`.

## Steps (about 15 minutes)

1. **Merge to `main`** (Render deploys from GitHub).
2. **Gmail app password** for sending account-setup emails: on the sending Gmail account, turn on
   2-step verification, then create an app password (Google Account → Security → App passwords).
3. On render.com: **New → Blueprint**, pick this repository. Render reads `render.yaml` and asks for:
   - `DJANGO_ALLOWED_HOSTS`: `fairly.onrender.com` (use the name Render shows for the service)
   - `DJANGO_CSRF_TRUSTED_ORIGINS` and `ACCOUNT_ORIGIN`: `https://fairly.onrender.com`
   - `EMAIL_HOST_USER` / `DEFAULT_FROM_EMAIL`: the Gmail address; `EMAIL_HOST_PASSWORD`: the app password
   - `FORTYTWO_CLIENT_ID` / `FORTYTWO_CLIENT_SECRET`: the 42 API app credentials
4. Wait for the first deploy (the build installs Python and Node packages, builds both apps, migrates,
   and provisions the staff roster from `backend/staff-roster.json`).
5. **Import the real students** once, from the Render service **Shell** tab:
   `cd backend && python manage.py import_42_profiles --campus-id <42 Amman campus id>`
6. Open a voting window from the staff app (Configuration → New window).

Students then sign in at `https://<service>.onrender.com/login`; on a phone they can *Add to Home Screen*
to install it as an app.

## Free-tier limits to know before a live demo

- **Sleeps after 15 minutes idle.** The first request after that takes about a minute. Open the site
  a few minutes before the demo, and keep a tab refreshing during it.
- **Files on disk are not kept across deploys or restarts.** Imported intra photos are stored on disk,
  so after a restart students show their cat meme until photos are imported again
  (`import_42_profiles` without `--skip-photos`). Ratings and accounts live in PostgreSQL and are safe.
- The free database is meant for trials (Render limits its lifetime); fine for the hackathon.

## Without a host: tunnel from a laptop

For a quick session where the laptop stays on: run the app locally, then
`cloudflared tunnel --url http://localhost:8000` gives a free public HTTPS address. Add that host to
`DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS` and `ACCOUNT_ORIGIN`, and set
`DJANGO_BEHIND_PROXY=true`.
