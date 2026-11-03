# Security and access plan

Required: Students see only their own star average. Received labels, other students' ratings, staff analytics, controls, and CSV exports are inaccessible to students through both UI and API. Student data must be stored securely and identifiers must not be public.

All implementation measures below are proposed ways to satisfy that requirement.

## Access matrix

| Resource or action | Unauthenticated | Student | Staff |
| --- | --- | --- | --- |
| Own session identity | Denied | Allowed | Allowed |
| Student own average and allowance | Denied | Own only | Use staff routes |
| Minimal approved peer directory | Denied | First name, last name, and Intra username search | Via staff student lookup |
| Submit student rating | Denied | Allowed under voting rules | Denied unless dual-role support is agreed |
| Received labels or individual received votes | Denied | Denied | Allowed |
| Other students' ratings | Denied | Denied | Allowed |
| Analytics, participation, abuse evidence | Denied | Denied | Allowed |
| Window controls, labels, invalidation, CSV | Denied | Denied | Allowed |

## Server boundaries

- Verify authentication, active state, email verification, and approval for protected application requests. Resolve staff role from trusted data, never a submitted domain or role.
- Public authentication entry routes use generic responses, rate limits, single-use hashed expiring setup tokens, and no public roster access. See authentication.md.
- Send setup mail to the student domain for imported students and the staff domain only for trusted staff records. Enabling manual approval never revokes existing approvals.
- Do not return credentials, token hashes, approval internals, or session secrets in profile responses.
- Derive self-scoped queries from the authenticated identity. A guessed ID, route parameter, or modified request body must not bypass the access matrix.
- Use an authenticated, minimal peer directory for recipient selection. An opaque ID is a reference, not an authorization mechanism.
- Keep database, mail, and temporary import credentials server-side. If clients can query the database directly, enforce equivalent database access policies and test them before exposure.
- Validate all input, use parameterized database operations, and render names and explanations as plain text.
- Use encrypted transport, restricted database access, and the chosen provider's encryption and backup controls. Keep real student data out of demo fixtures and source control.
- Apply session protections appropriate to the chosen authentication mechanism. Cookie sessions require secure cookie settings and CSRF protection for writes.
- Prevent shared caching of authenticated responses and downloads. Avoid private values in public URLs, logs, analytics, and error messages.
- Rate-limit authentication, directory lookup, and submission routes without confusing network retries with abuse.
- Do not return detector internals, abuse cases, received label counts, or received rating histories to students.

## Checks before implementation is considered complete

Exercise every staff endpoint as unauthenticated, student, and staff callers. Try forged voter IDs and role fields, another student's ID, stale sessions, and direct export requests. Inspect response bodies and browser network requests, not only hidden UI controls.

Verify no public asset, cache, or error response exposes student records or secrets. Confirm secret management, data retention, and backup access with the team before live deployment. Verify expired or replayed setup tokens fail, student mail cannot create a staff account, pending students cannot read protected routes, and enabling approval preserves established access.
