# Proposed voting rules

Status: Review draft. These rules implement the requirements using the defaults in [decisions](decisions.md). Unapproved defaults must not be treated as official requirements.

## Submit a rating

1. Authenticate an active student. Derive the voter from the session, never from request data.
2. Resolve the requested voting window and verify server time is within its interval.
3. Verify the voter and recipient belong to the window roster.
4. Apply the agreed self-voting and repeated-peer rules.
5. Check the student's accepted submission count against the current maximum.
6. Validate stars, label count, distinct labels, active labels, and star availability. Reject invented label IDs. Validate explanations only if D14 enables them.
7. Store the vote and labels atomically. Protect allowance checks against concurrent requests and configuration edits.
8. Return submission confirmation and the updated allowance. Never return the recipient's average or received labels.
9. Evaluate detection rules and make findings available to staff. Record findings reliably, using the same transaction or a durable job record; no untracked fire-and-forget work.

An identical retry with the same idempotency key returns the original result without consuming another vote. Reusing the key with changed content fails. A retry returns the current allowance, which may have changed since the original request.

## Windows and limits

Proposed interval: inclusive start, exclusive end. The server decides whether voting is open. The browser timer is only a display.

Staff may change window times and limits. Validate edits, reject stale versions, and audit the change. Preserve accepted votes when dates change. Closing or shortening a window blocks subsequent submissions once the new deadline is reached.

If the maximum is lowered below a student's current usage, show zero remaining votes and preserve their submissions. The minimum describes participation progress under D07; it does not prevent students from making a first vote. No automatic reset or recurring weekly schedule is assumed.

## Average and participation

Proposed average: ordinary arithmetic mean of valid ratings received in the current window, rounded to two decimal places for display. No ratings means `null`, not zero stars. No weighting, reputation adjustments, or publication threshold is assumed.

Participation uses accepted submissions, including later invalidated votes under D09. Staff receive both submission counts and valid counts with explicit names. Students see only their own average, allowance, and window information. Do not return received vote counts or individual received votes in the student baseline response.

## Staff review and invalidation

A suspicious pattern creates a staff case; it does not prove abuse. Proposed baseline: votes count until staff invalidate them, including 1-star votes. The specification does not mandate holding every 1-star vote.

Staff confirm a case, identify the particular abusive votes, and give a reason for invalidation. Atomically create the invalidation and audit record. Recompute or query averages using valid votes, and update affected analytics consistently. Keep the original vote for review. Repeat invalidation requests must not apply the effect twice.

## Label changes

New submissions use the current label catalog. Deactivated labels cannot be selected again, but remain visible in historical staff records. Under the proposed replacement policy, renamed labels receive new IDs so old votes retain their original meaning.
