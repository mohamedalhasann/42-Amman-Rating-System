# Local account setup and login

Account setup, approval and sign-in/out use only the local database and never call 42. The [staff React workspace](../staff-frontend/README.md) now uses these sessions and the database. Shared login on `feat/student-frontend` and the student frontend remain pending integration. No new React login page was added.

## Test locally

From `backend/`:

```sh
../.venv/bin/python manage.py migrate
../.venv/bin/python manage.py runserver
```

The existing Django `/account/` utility can test setup while the shared React login stays on its separate branch. The existing superuser also logs in at `/admin/`; open `/staff/` afterward in the same browser to test the built React workspace. Roles come from unique stored usernames. The legacy account-type control in the Django utility is ignored by the API.

1. For the student flow, use **your own imported, eligible Intra username** and click **Send setup link**. No password is required to request the link. The public response is generic, including when no eligible account exists.
2. In local debug mode, the default mail backend prints the setup email in the **runserver terminal**. It sends no external email. Treat the printed link as a private credential and do not share terminal logs. Console delivery is for local testing only; real mailbox ownership is verified only when the link is delivered through the configured email service.
3. Open the complete link, including `#token=...`, and create a password. The browser removes the fragment from the address bar; the token is not put into localStorage or ordinary request URLs. A refresh before submission loses the in-memory token; reopen the email link if necessary.
4. Manual approval is enabled by default. The setup result says to wait for staff approval; pending users cannot sign in or access profile APIs.
5. Use a separate browser/incognito session to sign in as **Staff** with your existing superuser credentials. The account page shows **Awaiting approval** and an **Approve** button for each verified eligible student. Approval records the staff actor and timestamp.
6. Return to the student session and sign in. It displays the student's own identity. Sign out to verify session revocation. The student dashboard remains a separate workstream.

No new `.env` entries are required for the default local flow. If using a port other than 8000, set `ACCOUNT_ORIGIN` to the exact trusted origin (for example `http://127.0.0.1:8001`) and restart Django. Setup links never use a caller-provided Host header, email address, role assignment, or redirect.

## Implemented policy

- Students must be imported, active locally, upstream-active, and eligible under the 42cursus rule. Public setup cannot create users or grant a staff role.
- Student setup mail goes only to `{intra_username}@student.42amman.com`. Provisioned staff setup goes only to `{intra_username}@42amman.com`. Existing usable passwords are never overwritten by setup. Account recovery is **not** implemented.
- Tokens use 32 cryptographically random bytes, are stored only as SHA-256 hashes, expire after 30 minutes, and are single use. Requesting another link invalidates previous unused links. A weak password does not consume a valid link. Merely opening a link makes no account changes.
- Token consumption, password hashing, email verification, and optional automatic approval share one transaction, with row locks. The current approval setting is read at completion time. PostgreSQL is needed to validate deployment-level row locking under concurrency; automated tests currently use SQLite.
- Manual approval defaults to enabled. Disabling it affects future setup completions only; already-pending students still need an explicit staff approval. Re-enabling never revokes existing approvals. Updates use a version check.
- Successful sign-in rotates the Django session key and CSRF token. Sessions expire after eight hours. Pending accounts receive no authenticated application session. Every protected request rechecks activation, verification, approval, eligibility, and staff role where required.
- JSON writes, including login, require CSRF. Get a token from `/api/v1/auth/csrf` and pass it as `X-CSRFToken`, with same-origin cookies. Cookie secure flags are enforced outside debug mode. The account pages use a restrictive CSP and no-referrer policy.
- Database-backed throttles hash their keys. Setup links are limited to three per account per hour; IP limits default to 300 setup requests/hour, 300 completion attempts/15 minutes, and 600 login attempts/15 minutes to accommodate campus NAT. Login also has a ten-attempt account limit per 15 minutes. Limits count requests, including unsuccessful and successful attempts. `REMOTE_ADDR` is used; untrusted forwarded headers are ignored. Deployment proxy configuration and actual campus traffic require tuning.
- Generic setup response bodies reduce direct username enumeration. Synchronous delivery can still have timing differences; a production mail queue would improve response consistency and delivery reliability. Expired throttle/token/session cleanup should be scheduled for a persistent deployment.
- Account setup, approval, setting changes, and sign-in/out create account audit records. Passwords, raw tokens, session secrets, mail bodies, and API credentials are not included. The console backend intentionally prints development setup links; it is rejected outside debug mode.

## API

| Method | Path | Input / access |
| --- | --- | --- |
| GET | `/api/v1/auth/csrf` | Public; returns `csrf_token` and cookie |
| POST | `/api/v1/auth/setup-request` | `intra_username`; generic 202, stored role determines delivery domain |
| POST | `/api/v1/auth/setup-complete` | `token`, `password`; returns `ready` or `awaiting_approval` |
| POST | `/api/v1/auth/login` | `intra_username`, `password`; sets session, returns stored role and rotated CSRF token |
| POST | `/api/v1/auth/logout` | Revokes current session |
| GET/PATCH | `/api/v1/staff/settings` | Trusted staff; PATCH needs `manual_student_approval_enabled` boolean and current `version` |
| GET | `/api/v1/staff/account-approvals` | Trusted staff; verified eligible pending profiles, `limit` and UUID `cursor` |
| POST | `/api/v1/staff/account-approvals/{profile_id}/approve` | Trusted staff; idempotent, no duplicate approval audit |

Use the profile UUID returned by the pending directory for approval, not the user UUID or 42 provider ID. Setup completion does not log the user in automatically. Legacy `account_type` is accepted but ignored: it cannot change the role, delivery domain or account throttle. Unknown JSON fields such as caller-supplied email are rejected.

## Trusted staff roster

The owner-approved list is in `backend/staff-roster.json`: `jsukkari`, `malhaimo`, `mosalim`, `abeleima`, `daomar`. Run `manage.py provision_staff` to apply it. The command is idempotent, sends no mail, grants no superuser permissions and creates no usable passwords. Staff must verify their staff-domain mailbox and set a password before sign-in.

If a listed username already belongs to a student, provisioning preserves the identity/history but invalidates credentials and outstanding setup links, clears verification and requires fresh staff-domain verification. Existing provisioned staff keep their credentials. Disabled accounts require explicit handling instead of silently being reactivated. A public form or React account screen cannot provision staff.

## Email deployment

Choose a real provider and configure `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, and an authorized `DEFAULT_FROM_EMAIL`. Set a trusted HTTPS `ACCOUNT_ORIGIN`, `DJANGO_DEBUG=false`, PostgreSQL, and deployment hosts. Credentials stay in `.env`/secret storage. Real email delivery has not been configured or tested.

The Django account page remains a test utility. Shared React login should send username-only setup requests and username/password login requests, then direct a staff response to `/staff/`. Configure its setup-link destination when that branch is integrated.

Implementation references: [Django authentication](https://docs.djangoproject.com/en/5.2/topics/auth/default/), [Django CSRF](https://docs.djangoproject.com/en/5.2/howto/csrf/), and [OWASP token-based recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), applied to first-time setup rather than password reset.
