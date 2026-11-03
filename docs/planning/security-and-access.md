# Security and access plan

Required: Students see only their own star average. Received labels, other students' ratings, staff analytics, controls, and CSV exports are inaccessible to students through both UI and API. Student data must be stored securely and identifiers must not be public.

All implementation measures below are proposed ways to satisfy that requirement.

## Access matrix

| Resource or action | Unauthenticated | Student | Staff |
| --- | --- | --- | --- |
| Own session identity | Denied | Allowed | Allowed |
| Student own average and allowance | Denied | Own only | Use staff routes |
| Minimal approved peer directory | Denied | Allowed after D13 agreement | Via staff student lookup |
| Submit student rating | Denied | Allowed under voting rules | Denied unless dual-role support is agreed |
| Received labels or individual received votes | Denied | Denied | Allowed |
| Other students' ratings | Denied | Denied | Allowed |
| Analytics, participation, abuse evidence | Denied | Denied | Allowed |
| Window controls, labels, invalidation, CSV | Denied | Denied | Allowed |

## Server boundaries

- Verify authentication and active account state for every protected request. Resolve staff role from trusted server data.
- Derive self-scoped queries from the authenticated identity. A guessed ID, route parameter, or modified request body must not bypass the access matrix.
- Use an authenticated, minimal peer directory for recipient selection. An opaque ID is a reference, not an authorization mechanism.
- Keep database credentials and identity-provider secrets server-side. If clients can query the database directly, enforce equivalent database access policies and test them before exposure.
- Validate all input, use parameterized database operations, and render names and explanations as plain text.
- Use encrypted transport, restricted database access, and the chosen provider's encryption and backup controls. Keep real student data out of demo fixtures and source control.
- Apply session protections appropriate to the chosen authentication mechanism. Cookie sessions require secure cookie settings and CSRF protection for writes.
- Prevent shared caching of authenticated responses and downloads. Avoid private values in public URLs, logs, analytics, and error messages.
- Rate-limit authentication, directory lookup, and submission routes without confusing network retries with abuse.
- Do not return detector internals, abuse cases, received label counts, or received rating histories to students.

## Checks before implementation is considered complete

Exercise every staff endpoint as unauthenticated, student, and staff callers. Try forged voter IDs and role fields, another student's ID, stale sessions, and direct export requests. Inspect response bodies and browser network requests, not only hidden UI controls.

Verify no public asset, cache, or error response exposes student records or secrets. Confirm secret management, data retention, and backup access with the team before live deployment.
