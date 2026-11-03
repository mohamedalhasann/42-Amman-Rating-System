# Authentication and roster plan

Status: Account flow agreed by the owner. Details marked proposed remain open. No live API collection is part of this documentation task.

## Import before API access ends

Collect authorized 42 Amman students' Intra usernames, first names, last names, and pictures while authorized 42 API access remains. Validate campus membership. Persist profiles locally in PostgreSQL with normalized unique student usernames. Re-imports update profiles without creating duplicates or resetting credentials, email verification, or approval. Import alone never verifies or approves a student.

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

A trusted staff record must exist first. Entering a username, submitting a role, or selecting a staff screen must never grant staff access. Staff provisioning and the initial administrator remain open decisions. Manual student approval does not apply to provisioned staff. A proposed `account_type` selector can disambiguate student and staff usernames, but selects an existing account instead of creating its role.

Proposed provisioning records staff approval in advance. Staff still need to verify their mailbox and set their password before sign-in, and their account must remain active.

## Approval setting

Staff control `manual_student_approval_enabled`. Email verification and account approval are separate persisted facts. Enabling the setting never clears either fact for established accounts. Evaluate the current setting transactionally when setup completes, not when the email is sent.

Handling previously verified pending students when the setting is disabled remains open. Proposed: approve them with an audit event. Individual account deactivation is separate from verification history.

## Proposed security details

Use high-entropy setup tokens, store only their hashes, enforce expiry and single use, rate-limit requests, and build links from a trusted configured origin. Never email passwords or log tokens. These measures follow [OWASP password recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), applied to first-time setup.

Proposed session mechanism: opaque server-side sessions in secure HTTP-only cookies with CSRF protection for writes. Session lifetime, password policy and hashing parameters, setup-token expiry, and mail provider remain open. Recovery after setup requires a separate purpose-bound flow that cannot bypass approval or staff provisioning.
