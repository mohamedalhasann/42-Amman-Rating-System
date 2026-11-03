# Decisions to settle

Every entry is open. Recommendations are proposals, not approved requirements. Replace an entry's status only after team agreement and record the date and owner.

## Blocking decisions before implementation

| ID | Question | Proposed default | Affects |
| --- | --- | --- | --- |
| D01 | What stack, database, and deployment target will the team use? | Choose together; no choice assumed here. | Setup, migrations, hosting |
| D02 | How do users sign in and who provides the student roster and staff roles? | Trusted campus identity if available; confirm integration access before choosing. No client-selected roles. | Authentication, participation totals |
| D03 | Can students rate themselves? | Reject self-votes. | Validation and constraints |
| D04 | Can one student rate the same peer more than once in a window? | One accepted rating per pair per window. Detect repeat attempts separately. | Unique constraint, abuse detection |
| D05 | How many labels must a rating have? | At least one distinct label; upper bound needs agreement. | Submission validation |
| D06 | Which positive labels are available at 2 stars? | Ask staff; do not guess. | Initial label catalog |
| D07 | What does the minimum vote count enforce? | Track participation below the minimum; do not block partial progress or fabricate votes. | Dashboard and window closure |
| D08 | Is the student's average for all windows or the current window? | Current window, clearly identified in the response. | Dashboard, staff analytics |
| D09 | Does invalidation restore the voter's allowance? | No. Accepted submissions consume allowance even after invalidation. | Remaining votes and participation |
| D10 | Who belongs to a window's participation roster? | Snapshot active students when staff creates the window; review mid-window additions separately. | Non-voter denominator |
| D11 | Are multiple windows allowed to overlap? | One active window at a time. Reject overlapping ranges. | Student dashboard, configuration |
| D12 | What happens if staff lower a maximum below votes already submitted? | Retain existing votes and allow no further votes from students already at or above the maximum. | Window updates |
| D13 | How do students identify a peer without exposing private identifiers? | Authenticated directory with an approved display name and opaque recipient ID only. Ask staff which display fields are acceptable. | Peer selection, privacy |
| D14 | Are explanations accepted or required for serious votes? | Do not make them mandatory without agreement. If accepted, staff-only plain text with a bounded length. | Malicious serious vote review |
| D15 | What thresholds and observation intervals trigger abuse alerts? | Start with explainable configurable rules; agree numeric values and test fixtures before coding. | Detection accuracy and scope |

## Other decisions before the relevant feature is built

- Decide whether students may edit or withdraw a submitted rating. Proposed baseline: no student edit or withdrawal flow.
- Decide whether invalidated votes can be restored. Proposed baseline: invalidation is final for this hackathon, with an audit trail.
- Confirm allowed window edits and treatment of accepted votes outside revised dates. Proposed baseline: preserve submissions and their window membership; date edits govern new submissions.
- Choose average rounding, timestamp display timezone, list limits, and CSV columns. Proposed average: two decimal places, with `null` when there are no valid ratings.
- Decide how label edits preserve past meaning. Proposed baseline: rename by replacing the label record and deactivate the old one; never overwrite historical wording.
- Confirm treatment of departing students, data retention, and export retention with staff.
- Agree which staff may assign staff roles and which deployment mechanism manages initial staff access.

## Decision record template

```text
Decision ID:
Status: agreed
Date:
Owner:
Chosen rule:
Reason:
Documents and mock responses updated:
```
