# Voting rules

Status: Owner policies recorded in [decisions](decisions.md). Technical details remain proposed. The official PDF examples are preserved in requirements.md; the catalog below is the owner's initial selection, not a verbatim copy of those examples.

## Initial catalog and submission behavior

| Stars | Allowed labels or flags | Selection and explanation | Initial treatment |
| --- | --- | --- | --- |
| 3 | Helpful; Good teammate; Community contributor; Respectful | Labels optional, explanation optional | Counts immediately |
| 2 | Helpful; Good teammate; Community contributor; Respectful; Unreliable teammate; Disruptive | Explanation optional; labels proposed optional | Counts immediately |
| 1 | Aggressive behavior; Disrespectful; Disruptive; Unreliable teammate; Other | At least one flag and a nonblank explanation required | Counts immediately |

`Other` is a configured flag, not an arbitrary new label. Staff can manage the catalog. Exact label selection and explanation length limits remain open. Review this smaller initial catalog with staff.

## Submission

1. Authenticate an active, verified, approved student and derive voter ID from the session.
2. Resolve the single open window using server time and completed opening-roster capture.
3. Verify voter and recipient membership and current account eligibility.
4. Reject self-votes and existing submissions for the pair in that window, including invalidated votes.
5. Check accepted submissions against the current maximum. Invalidated submissions also consume allowance.
6. Validate stars, catalog IDs, allowed mappings, distinct selections, and required 1-star flag and explanation.
7. Insert the vote and selections atomically, with concurrency protection against other submissions and configuration edits.
8. Return confirmation, own submission state, and current allowance. Never return the recipient's score or received labels.
9. Persist detection findings or durable work so background processing cannot silently lose them.

An identical retry with the same idempotency key returns the original submission and current allowance without another vote. A changed request with the same key fails. Network retries are not repeat-voting abuse.

## Windows and participation

Proposed interval: inclusive start, exclusive end. One active window is allowed; proposed enforcement rejects overlapping ranges. Capture approved, active, eligible 42 Amman students when the window opens. Mid-window additions remain open. Deactivated accounts cannot vote even if in the snapshot.

Staff can edit dates and limits with stale-version checks and audit records. Preserve submissions and, provisionally, the opening roster after edits. New submissions follow the current dates. Lowering the maximum never removes votes: remaining allowance is clamped at zero.

Keep a configurable minimum as a participation target for staff reporting, without penalties or submission blocking. Proposed initial minimum: zero. No weekly reset or recurring schedule is assumed.

## Average

Student average is the arithmetic mean of counted received ratings across all windows. Exclude invalidated votes. Proposed rounding: two decimals; no counted ratings means `null`. The average remains available when no voting window is open.

Participation uses accepted submissions. Staff see submitted, counted (valid), and invalidated totals separately. Students do not receive received-label summaries, received vote counts, or individual received records.

## Abuse review and invalidation

All accepted votes count immediately toward student averages. 1-star votes require flags and an explanation, which provide vital context and evidence if a vote is flagged or investigated for abuse.

Abuse cases describe suspicious voting patterns across the 8 required scenarios. Staff review open cases in one unified view, confirm abuse, and invalidate specific linked votes, preserving original records and decision history. Invalidation updates recipient averages immediately and never restores the voter's allowance.



## Label changes

New submissions use the current catalog. Deactivation blocks new selection while preserving history. Proposed rename policy: replacement label records rather than overwriting historical wording.
