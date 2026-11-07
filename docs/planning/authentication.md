# Authentication and roster plan

Status: [Shared accounts, recovery and trusted provisioning](../../backend/ACCOUNTS.md), profile imports and both React frontends are connected. The existing shared login from `main` routes by stored role. See [startup](../../INTEGRATION.md). Real email delivery and PostgreSQL concurrency verification remain pending.

## Import before API access ends

Collect authorized 42 Amman students' Intra usernames, first names, last names, and pictures while authorized 42 API access remains. Validate campus membership. Persist profiles locally in PostgreSQL with normalized unique student usernames. Re-imports update profiles without creating duplicates or resetting credentials, email verification, or approval. Import alone never verifies or approves a student.

Owner clarification: import only non-staff students whose upstream account has `active? = true` and whose enrollment includes the exact `42cursus` cursus. Piscine-only and Pro Piscine-only accounts do not qualify. A student may have Piscine history alongside 42cursus. The backend records this eligibility independently from local account activation and approval; older broad imports require rechecking and non-qualifying historical profiles are retained as excluded rather than deleted.

Proposed photo storage: copy authorized images into controlled durable storage and persist object keys in PostgreSQL. Confirm whether image bytes should instead live inside PostgreSQL. A remote Intra image URL alone is insufficient if access disappears. Normal login, search, and rating requests must work without the 42 API. Confirm import completeness while access is available. A later trusted roster-update process remains open.

## Student setup and sign-in

1. Student enters Intra username. Server resolves an existing authorized imported student record.
2. If no password exists, send a setup link to `{intra_username}@student.42amman.com`. Never accept a client-provided delivery address.
3. Return the same public response for unavailable, already-set-up, and eligible usernames to limit enumeration.
4. Student opens the link and creates a password. Validate and consume the token, store a password hash, and mark email verified atomically.
5. If manual approval is disabled at completion time, grant approval. Otherwise wait for a staff decision.
6. Future login uses username and password. Application access requires active state, verified email, and approval. A pending student receives a restricted pending status, not application data.

## Staff setup

Authorized staff also set their password through an email link, delivered to `{intra_username}@42amman.com`. There is no literal plus sign and no `student` component in that domain.

A trusted staff record must exist first. Entering a username, submitting a role, or selecting a staff screen never grants staff access. The owner supplied five staff usernames; the local `provision_staff` command provisions that roster. The existing `createsuperuser` command provides initial administration. Manual student approval does not apply to provisioned staff. Usernames are globally unique; the backend determines the stored role without a login selector. Legacy `account_type` input is ignored.

Proposed provisioning records staff approval in advance. Staff still need to verify their mailbox and set their password before sign-in, and their account must remain active.

## Approval setting

Staff control `manual_student_approval_enabled`. Email verification and account approval are separate persisted facts. Enabling the setting never clears either fact for established accounts. Evaluate the current setting transactionally when setup completes, not when the email is sent.

Implemented default: disabling manual approval applies to future setup completions. Existing verified pending students remain pending for explicit staff approval, matching the staff preview policy. Individual account deactivation is separate from verification history.

## Proposed security details

Use high-entropy setup tokens, store only their hashes, enforce expiry and single use, rate-limit requests, and build links from a trusted configured origin. Never email passwords or log tokens. These measures follow [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), applied to first-time setup.

Implemented transport uses Django server-side sessions, secure HTTP-only cookies outside debug, and CSRF for writes. Approved sign-ins last eight hours; pending sign-ins last 15 minutes and can read only their own identity/status. Passwords require at least 10 characters and Django validators. Setup/reset links expire in 30 minutes; recovery is purpose-bound and preserves verification/approval while invalidating old credentials/sessions. Mail provider and production validation remain open.
