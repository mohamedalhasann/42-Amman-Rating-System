# Team decisions

Updated 3 November 2026 from the project owner's instructions. Agreed team policies are distinct from official hackathon requirements. Technical details marked proposed remain open.

| ID | Status | Current policy |
| --- | --- | --- |
| D01 | Partially agreed | NestJS backend, React frontend, PostgreSQL database. Deployment open. |
| D02 | Agreed | Import authorized 42 Amman usernames, first names, and pictures while 42 API access remains. No runtime API dependency. Username/password login after email setup. Students use `{intra_username}@student.42amman.com`; staff use `{intra_username}@42amman.com`. |
| D03 | Agreed | No self-votes. |
| D04 | Agreed | One submission per voter-recipient pair per window, including held and invalidated submissions. Proposed: rejected submissions also retain that reservation. |
| D05 | Agreed with proposed detail | 3-star labels optional. At least one flag and a nonblank explanation required at 1 star. Proposed: 2-star labels optional too. Exact selection and text length limits open. |
| D06 | Agreed | Owner's initial mappings are in voting-rules.md. All four selected positive labels are also available at 2 stars. Staff retain catalog management. |
| D07 | Selected under delegated judgment | Keep the staff-configurable minimum as a participation target to satisfy the PDF. Report progress without penalties, forced voting, or submission blocking. Proposed initial minimum: zero. |
| D08 | Agreed | Student average includes counted ratings received across all voting windows. |
| D09 | Agreed | Invalidation does not restore allowance. Held votes consume allowance. Proposed: rejected votes also keep allowance consumed. |
| D10 | Agreed | Snapshot approved, active, eligible 42 Amman students when the window opens, not when created. Mid-window additions open. |
| D11 | Agreed | Only one active window at a time. Proposed enforcement: reject overlapping intervals, including edits. |
| D12 | Agreed | Lowering the maximum preserves existing votes. Remaining allowance cannot fall below zero. |
| D13 | Agreed | Store unique student `intra_username`, `first_name`, and imported picture. Search by first name or username; display both. Ratings reference internal IDs. |
| D14 | Agreed | Explanation required at 1 star, optional at 2 and 3. 1-star votes held pending staff approval or rejection. 2-star and 3-star votes count immediately. |
| D15 | Deferred by owner | Abuse thresholds, observation intervals, and minimum sample sizes. Revisit before detector implementation. |
| D16 | Deferred by owner | Whether suspicious 2-star or 3-star votes can be held. Do not implement automatic holds for them until decided. |
| D17 | Agreed | Staff can toggle manual student approval. Disabled: email password setup grants approval. Enabled: new verified students await staff approval. Enabling it never removes established verification or approval. |

## Open details before the relevant feature is built

- Deployment target, mail provider, session implementation, password policy, setup-token lifetime, and rate limits.
- Trusted staff roster provisioning and initial administrator. Staff setup cannot be self-authorized.
- Treatment of already-verified pending students when manual approval is disabled. Proposed: approve them with an audit event.
- Durable photo storage and access policy. Proposed: copy image objects into controlled storage and keep references in PostgreSQL instead of relying on Intra URLs.
- Eligibility changes after a window opens. Proposed: preserve the snapshot and add new students next window. Deactivated accounts cannot access the application.
- Student edits, withdrawals, restoration of rejected votes, departing students, and retention. No edit, withdrawal, or restoration flow is approved yet.
- Proposed defaults: two-decimal averages, `null` for no counted ratings, UTC storage, stable historical label wording, and preserved submissions after window date edits.
- Confirm the deadline timezone and review the smaller initial label catalog with staff. Official PDF examples remain separate in requirements.md.

## Review checkpoints

Resolve mail delivery and deployment before the live account-setup demo. Revisit D15 and D16 before implementing abuse handling. These are work checkpoints, not scheduled reminders.
