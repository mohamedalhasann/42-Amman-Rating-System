# Shared accounts, setup and recovery

The shared React login from `frontend/` now serves students and staff. See [run instructions](../INTEGRATION.md). Ordinary authentication and app requests use the local database and never call 42.

## Account lifecycle

- Imported students start with unusable passwords and no verification/approval. Importing alone grants no access.
- The unique stored username determines the trusted role. Public requests cannot create users, select roles or supply delivery addresses. Legacy `account_type` is accepted but ignored.
- Setup links go only to `{username}@student.42amman.com` for eligible imported students or `{username}@42amman.com` for trusted staff. The public response is generic. An existing password cannot be overwritten through setup.
- Links use 32 random bytes, stored as SHA-256 hashes, with a 30-minute expiry and single use. Reissuing invalidates previous links. Opening a link changes no account state; weak passwords do not consume it.
- Setup completion validates the password, consumes tokens, marks email verified and applies the current approval setting atomically. Passwords need at least 10 characters and Django's other validators.
- Manual approval defaults on. Disabling it affects future setup completions; existing verified pending accounts remain pending until explicitly approved. Established approvals are retained. Settings are versioned.
- Password-verified pending students can sign in to a 15-minute session restricted to `/me` (their own display identity/status) and logout. Dashboard, peers, images, profile writes, voting and staff routes remain blocked. Approval changes `/me.status` to active; the waiting page's Check again action continues to onboarding.
- Approved sessions last eight hours from sign-in. Django rotates session and CSRF tokens on login. Every request checks active state, mailbox verification, approval, current eligibility and role.
- Recovery uses a separate purpose-bound token table, bound to the current credential hash. It only applies to verified eligible accounts with passwords. Completion changes the password and consumes outstanding reset/setup links; it never changes role, activation, verification or approval. Old session auth hashes fail on the next request. The current session is also logged out.

## Trusted staff roster

The owner-approved list is in `backend/staff-roster.json`: `jsukkari`, `malhaimo`, `mosalim`, `abeleima`, `daomar`. `manage.py provision_staff` is idempotent, sends no mail, grants no superuser privileges and creates no usable password. Staff still verify their staff mailbox and set a password through the shared setup screen.

Promoting a listed existing student preserves identity/history but invalidates the credential and outstanding setup links, clears verification and requires staff-domain verification. Existing provisioned staff keep credentials. Disabled accounts require explicit handling. The React account page cannot provision staff. `createsuperuser` remains the trusted initial-administrator path.

## API

| Method | Path under `/api/v1` | Behavior |
| --- | --- | --- |
| GET | `/auth/csrf` | Public bootstrap; token/cookie for JSON writes |
| POST | `/auth/setup-request` | `{intra_username}`, generic 202 |
| POST | `/auth/setup-complete` | `{token,password}`, returns `status: ready` or `awaiting_approval` |
| POST | `/auth/password-reset-request` | `{intra_username}`, generic 202 |
| POST | `/auth/password-reset-complete` | `{token,password}`, returns `status: ready` and `intra_username`; logs out current session |
| POST | `/auth/login` | `{intra_username,password}`, returns stored role, rotated CSRF token and `signed_in` or `awaiting_approval` |
| POST | `/auth/logout` | Revokes current session |
| GET | `/me` | Own identity, `picture_url`/legacy `photo_url`, role, active/pending status, own preferences; pending preferences are null |
| GET/PATCH | `/staff/settings` | Staff only; versioned `manual_student_approval_enabled` |
| GET | `/staff/account-approvals` | Staff only; verified eligible pending profiles with UUID cursor/limit |
| POST | `/staff/account-approvals/{profile_id}/approve` | Staff only; idempotent approval and audit |

All writes require CSRF, including login/setup/reset. Unknown JSON fields are rejected. Approval uses the internal profile UUID, never a 42 provider ID. Setup completion does not auto-login. Missing/expired setup links return `INVALID_SETUP_LINK`; reset links return `INVALID_TOKEN`.

## Mail, limits and deployment

Use the configured trusted `ACCOUNT_ORIGIN` for links: `/setup/complete#token=...` or `/reset/complete#token=...`. The browser strips the fragment and never persists the token. Host headers, posted emails and posted roles cannot change a destination. Legacy `/account/` and `/account/setup/` redirect to the shared React screens.

In local console-mail mode, links appear in the Django terminal and no external mail is sent. Mailbox ownership is established only when mail is actually delivered to the configured campus mailbox. Configure SMTP, approved sender, HTTPS origin, production hosts and PostgreSQL for deployment. Production console mail is rejected. Real SMTP delivery remains unverified.

Setup and reset each allow three requests per account per hour, plus configured shared-campus IP limits. Completion/login limits are separate. Throttle identities are hashed, and caller-supplied forwarding headers are ignored. Tune trusted proxy/network limits for deployment.

Account audit records contain no passwords, raw tokens, session secrets or mail bodies. Development console email intentionally prints test links; do not share them. Synchronous mail may expose timing differences; production queuing, cleanup of expired sessions/tokens/throttles, and PostgreSQL concurrency testing remain deployment work.
