# Team decisions

Updated 3 November 2026 from the project owner's instructions. Agreed team policies are distinct from official hackathon requirements. Technical details marked proposed remain open.

| Question | Status | Current policy |
| --- | --- | --- |
| What stack, database, and deployment target will the team use? | Partially agreed | Django backend, React frontend, PostgreSQL database. Deployment open. |
| How do users sign in, and who provides the student roster and staff roles? | Agreed | Import authorized 42 Amman usernames, first names, last names, and pictures while 42 API access remains. No runtime API dependency. Username/password login after email setup. Students use `{intra_username}@student.42amman.com`; staff use `{intra_username}@42amman.com`. |
| Can students rate themselves? | Agreed | No self-votes. |
| Can one student rate the same peer more than once in a window? | Agreed | One submission per voter-recipient pair per window, including invalidated submissions. |
| How many labels must a rating have? | Agreed with proposed detail | 3-star labels optional. At least one flag and a nonblank explanation required at 1 star. Proposed: 2-star labels optional too. Exact selection and text length limits open. |
| Which positive labels are available at 2 stars? | Agreed | Owner's initial mappings are in voting-rules.md. All four selected positive labels are also available at 2 stars. Staff retain catalog management. |
| What does the minimum vote count enforce? | Selected under delegated judgment | Keep the staff-configurable minimum as a participation target to satisfy the PDF. Report progress without penalties, forced voting, or submission blocking. Proposed initial minimum: zero. |
| Is the student's average for all windows or the current window? | Agreed | Student average includes counted ratings received across all voting windows. |
| Does invalidation restore the voter's allowance? | Agreed | Invalidation does not restore allowance. All accepted votes consume allowance. |
| Who belongs to a window's participation roster? | Agreed | Snapshot approved, active, eligible 42 Amman students when the window opens, not when created. Mid-window additions open. |
| Are multiple windows allowed to overlap? | Agreed | Only one active window at a time. Proposed enforcement: reject overlapping intervals, including edits. |
| What happens if staff lower a maximum below votes already submitted? | Agreed | Lowering the maximum preserves existing votes. Remaining allowance cannot fall below zero. |
| How do students identify a peer without exposing private identifiers? | Agreed | Store unique student `intra_username`, `first_name`, `last_name`, and imported picture. Search by first name, last name, or username; display the full name and username. Ratings reference internal IDs. |
| Are explanations accepted or required for serious votes? | Agreed | Explanation required at 1 star, optional at 2 and 3. All accepted votes count immediately (no held status). Explanations and flags provide evidence if a vote is reviewed for abuse. |
| What thresholds and observation intervals trigger abuse alerts? | Deferred by owner | Abuse thresholds, observation intervals, and minimum sample sizes. Revisit before detector implementation. |
| Are votes held before counting? | Agreed | No. In accordance with the hackathon specification, all accepted votes count immediately; staff invalidate votes confirmed as abuse. |
| Can staff require manual approval for new students? | Agreed | Staff can toggle manual student approval. Disabled: email password setup grants approval. Enabled: new verified students await staff approval. Enabling it never removes established verification or approval. |

## Open details before the relevant feature is built

- Deployment target, mail provider, session implementation, password policy, setup-token lifetime, and rate limits.
- Trusted staff roster supplied by the owner and provisioned by local command; initial administration uses `createsuperuser`. Staff setup cannot be self-authorized. The shared React login remains on its separate branch and will infer roles from stored usernames.
- Treatment of already-verified pending students when manual approval is disabled. Proposed: approve them with an audit event.
- Durable photo storage and access policy. Proposed: copy image objects into controlled storage and keep references in PostgreSQL instead of relying on Intra URLs.
- Eligibility changes after a window opens. Proposed: preserve the snapshot and add new students next window. Deactivated accounts cannot access the application.
- Student edits, withdrawals, departing students, and retention. No edit or withdrawal flow is approved yet.
- Proposed defaults: two-decimal averages, `null` for no counted ratings, UTC storage, stable historical label wording, and preserved submissions after window date edits.
- Confirm the deadline timezone and review the smaller initial label catalog with staff. Official PDF examples remain separate in requirements.md.

## Review checkpoints

Resolve mail delivery and deployment before the live account-setup demo. Revisit abuse thresholds before implementing abuse handling. These are work checkpoints, not scheduled reminders.
