# Proposed abuse detection and staff review

Required: Identify unusual voting, explain each case in plain language, show involved students and all mechanisms in one staff view, and allow staff to invalidate votes confirmed as abuse.

The eight examples below come from the main PDF. The detection methods are proposals. Numeric thresholds, observation periods, minimum sample sizes, and rule versions must be agreed under D15. Suspicion alone does not prove abuse.

| Required example | Proposed evidence and detection | Staff explanation example |
| --- | --- | --- |
| Bulk votes | Count distinct voters targeting one recipient in a short interval, regardless of stars. | Several students rated this student within a short period. |
| Repeated votes | Repeated voter-recipient submissions or authenticated attempts; exclude identical network retries. | This student repeatedly attempted to rate the same peer. |
| Group voting | Similar stars or labels from several voters targeting one student within an interval. | Several students gave the same low rating and labels to this student close together. |
| Pair voting / revenge | Reciprocal ratings with timing and star changes that merit review. | These students rated each other shortly apart; one gave a low rating after receiving one. |
| Friends boosting | A small group with unusually dense internal 3-star ratings compared with votes outside the group. | Most high ratings in this group were exchanged with each other. |
| Too fast or too often | Per-voter accepted submissions and non-retry attempts over short intervals. | This student submitted an unusually large number of votes in a short time. |
| Extreme voter | All 1-star or all 3-star ratings over an agreed minimum sample size. | This student used only 1-star ratings across the reviewed votes. |
| Malicious serious vote | Flag suspicious 1-star submissions for staff verification; validate catalog IDs and inspect the required explanation. | This serious report needs staff verification; its claim may be unsupported. |

An invalid label ID is rejected at submission, but a valid label can still contain a false accusation. Software cannot establish whether a real-world explanation was invented. Staff must assess context; do not advertise automatic truth detection. The agreed policy requires flags and an explanation for every 1-star vote; these votes are held independently of detector findings.

## Detection workflow

1. Evaluate newly accepted submissions and relevant authenticated attempts against versioned rules.
2. Use scheduled scans for group and historical patterns that a single-request check cannot capture.
3. Deduplicate or update cases so rerunning a scan does not flood staff with identical alerts.
4. Store students, linked votes or attempts, observed interval, readable findings, and supporting counts.
5. Present one queue with every applicable mechanism and a case detail view. Keep algorithm parameters out of the main explanation; provide supporting facts to staff.
6. Staff confirm or dismiss the suspicion with a reason. Confirmation alone does not delete or invalidate every linked vote.
7. Staff invalidate particular confirmed abusive votes. Record the decision and recalculate affected averages and valid totals.

Agreed baseline: all 1-star submissions are held until staff approve or reject them. Their queue is distinct from abuse cases. Whether suspicious 2-star or 3-star votes can be held is deferred in D16; detection cannot silently introduce that behavior. No automatic student penalties or future-vote discounts are approved. Resolve D15 thresholds before implementing the rules.

## Verification fixtures

Prepare synthetic examples for all eight rows, plus ordinary voting, a small sample of identical star values, legitimate reciprocal ratings, and retried requests. Confirm that alerts identify the correct students, facts, and windows. Verify dismissal leaves votes unchanged and invalidation changes only selected votes. Detection should work across its documented observation interval; window filtering must not accidentally hide cross-window evidence if a rule uses it.
