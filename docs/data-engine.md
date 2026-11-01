# Data Engine (Part 2): Design Proposal

## Role

The Data Engine decides how much each vote counts, how trustworthy each voter is, which votes look risky, and what score each student ends up with. It works on the vote record produced by the Voting Gate and returns scores to the Gate and risk information to the Staff Dashboard. **The engine never punishes anyone.** It produces scores and alerts, and staff make every decision.

Vote data is stored permanently and is never overwritten. Scores, weights and integrity are derived from it, so a staff decision or a settings change only requires a recomputation.

---

## 1. Inputs and Outputs

**From the Voting Gate:** voter, voted student, category, role (After evaluation only), stars, labels or flag, explanation, time, undone status, plus the categories, star rules, label and flag lists with their dimensions, handling levels, and voting limits.

**From the Staff Dashboard:** staff decisions on held votes (confirm, reject) and their meaning, and the settings staff can change.

**To the Voting Gate:**
- Each student's overall rating, and whether it has reached 5 different raters
- Monthly trend points
- Label counts per student
- Votes left this week, per category
- Whether a vote is allowed, and which blocked case applies if not

**To the Staff Dashboard:** vote weight, risk level and the reason for it, status, integrity scores, per-dimension scores, and the metrics with their definitions (section 9).

---

## 2. When a Vote Counts

| Status | Meaning |
| --- | --- |
| Counted | Included in the student's score |
| Held | Waiting for staff review; not included |
| Rejected | Excluded for good |

- 3-star and 2-star votes are **counted** immediately, unless the engine rates them high risk (section 5).
- Every 1-star vote is **held** until staff confirm or reject it.
- An undone vote is removed completely, and the weekly vote is given back.
- A counted vote does not change the public rating at once (see section 6).

---

## 3. Vote Weight

Each counted vote receives a weight:

**weight = category weight × voter integrity × repeat factor × voter-habit factor**

| Factor | Rule |
| --- | --- |
| Category weight | After evaluation and General votes carry different weights. The category is chosen by the voter and is not verified, so the difference is kept small. |
| Voter integrity | Votes from voters whose flags are usually confirmed by staff count fully. Votes from voters with rejected flags or suspicious patterns count less (section 4). |
| Repeat factor | The same voter rating the same student again within a month counts for progressively less. Three similar votes carry roughly the weight of one. |
| Voter-habit factor | A voter who gives nearly every student the same number of stars carries less information, so their votes count somewhat less. |

Age is handled separately when the score is calculated (section 6).

---

## 4. Voter Integrity

Each voter has an integrity score that starts neutral.

**Raises integrity**
- Flags and 1-star votes confirmed by staff
- Consistent voting over time (regular, spread-out votes)

**Lowers integrity**
- Flags and 1-star votes rejected by staff
- Taking part in a detected abuse pattern (section 5)
- Voting unusually fast or unusually often

Low integrity reduces vote weight. Very low integrity causes that voter's votes to be held for review, regardless of stars. Integrity is visible to staff only.

---

## 5. Abuse Patterns and Risk Levels

The engine detects patterns using fixed, explainable rules. Every alert carries a readable reason.

| Pattern | What it looks for |
| --- | --- |
| Pile of low votes | Several low votes on one student in a short time |
| Voting wave | A group of voters voting the same way on the same student |
| Pair voting | Two students voting for each other in sync |
| Too frequent | Votes submitted unusually close together or in unusual volume |
| Extreme voter | A voter who only gives the extreme star values |

**Risk levels**

| Level | What happens |
| --- | --- |
| Low | The vote counts silently. |
| Medium | The vote counts, and the case appears in the staff dashboard with its reason. |
| High | The vote is held for staff review, whatever its stars. |

**Gate handling levels, applied by the engine**

| Gate level | Engine behavior |
| --- | --- |
| Counts silently | 3-star and 2-star votes with low risk |
| Review | Every 1-star vote is held |
| Immediate alert | Aggressive behavior, Bad Evaluator and "Didn't understand their own code" go to the top of the queue, marked urgent |
| Repeat alert | No-show, Late, Disrespectful, Unreliable teammate and Disruptive alert staff when the same student receives the same one 3 times within a month (2-star and 1-star votes count) |

---

## 6. Student Score

- **Calculation:** a weighted average of the stars of counted votes. Each vote's weight is its vote weight (section 3) reduced by age, so older votes lose influence over time and students can improve.
- **Few votes:** a student with few votes is pulled toward the campus average. The pull fades as votes accumulate, so a small number of votes cannot swing a score.
- **Minimum before showing:** votes from at least 5 different raters. The engine counts distinct raters, not votes.
- **Public update:** the public rating is recalculated at the weekly run (Sunday, when limits reset), and changes only if enough new counted votes have arrived since the last update (initially 5). It is never updated live after a single vote.
- **Monthly trend:** one point per month, shown only for months with at least 3 new ratings, and only once two such months exist.
- **Label counts:** counted per label for each student, shown to the student without any rater information.
- **Per-dimension scores:** for each dimension (Help, Teamwork, Community, Conduct, Evaluator quality, Evaluation readiness), a score based on the weighted positive and negative labels. Staff only.

---

## 7. Enforcement of Voting Limits

The engine enforces the limits defined by the Voting Gate and tells the Gate which blocked case applies.

- General votes: 3 per week
- After evaluation votes: 10 per week, counted separately
- Same student: once per week in each category
- No rating yourself
- Weekly reset on Sunday

Staff can change these values in the dashboard. The Gate displays them.

---

## 8. Effect of Staff Decisions

| Decision | Vote status | Voter integrity | Student score |
| --- | --- | --- | --- |
| Confirm a held vote | Counted | Raised | Updated at the next weekly run |
| Reject a held vote | Rejected | Lowered | Unchanged |
| Reject a vote that was already counted | Rejected | Lowered | Recalculated |
| Dismiss an alert | No change | No change | No change |

This table is a proposal for the Staff Dashboard owner to review. The meaning of each decision is confirmed together with the Dashboard.

---

## 9. Metrics for the Dashboard

| Metric | Definition |
| --- | --- |
| Student score | Weighted, age-adjusted average of counted star votes |
| Score ready | Whether the student has votes from at least 5 different raters |
| Monthly trend | Weighted average of votes received in a month, shown for months with at least 3 new ratings |
| Voter integrity | Reliability of a voter, based on staff decisions on their votes and on their voting pattern |
| Risk level | Low, Medium or High, with the reason for the rating |
| Flag confirmation rate | Share of a voter's flags that staff confirmed |

---

## 10. Settings (initial values, adjustable by staff)

| Setting | Initial value |
| --- | --- |
| Minimum different raters before a score is shown | 5 |
| New counted votes needed for a public update | 5 |
| Age at which a vote's influence is halved | About 8 weeks |
| Repeat factor (same voter, same student, within a month) | 1st: full, 2nd: half, 3rd and later: quarter |
| Repeat alert | 3 occurrences within a month |
| Category weights | After evaluation slightly higher than General (the category is self-declared) |

---

## 11. Known Limitations and Points for Discussion

1. **Self-declared category.** The voting student states whether a vote is After evaluation or General. The engine cannot check that an evaluation took place or whether it was passed or failed (ratings given right after a fail are usually harsher). For this reason the weight difference between the two categories is kept small, and protection relies mainly on the abuse pattern rules in section 5.
2. **Public update rule.** The public rating updates at the weekly run once 5 new counted votes have arrived. The value is adjustable.
3. **Category weights.** The exact values are set during implementation.
4. **Staff decisions.** Section 8 is proposed for the Staff Dashboard owner to review and confirm.

---

## 12. For the Staff Dashboard Owner to Handle

The following points concern staff decisions and process. They are outside the Data Engine, but some of them change what the engine needs to record or recalculate.

1. **Questioning on flags.** Staff question both the flagger and the flagged student, which discourages misuse of flags. Decide whether this applies to every 1-star flag or only to severe ones, and how the flagger's identity is protected during questioning.
2. **No penalty without a conversation.** A penalty is applied only after a face-to-face discussion in which the student can present their case and appeal.
3. **Two-person decisions.** Penalties are agreed by at least two staff members, and each decision is written down with its reason and the student's statement.
4. **Small and temporary penalties.** Penalties are limited in size and duration.
5. **Access and settings log.** Staff access to voter identities is logged, and every change to the settings (limits, thresholds, labels, flag reasons) is recorded with its author and reason.
6. **Rejected votes.** Decide whether a rejected vote is deleted or kept with a "rejected" status (the engine currently keeps it, which preserves an audit trail), and whether the voter is informed.
