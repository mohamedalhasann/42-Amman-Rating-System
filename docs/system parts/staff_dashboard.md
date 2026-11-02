# Staff Dashboard (Part 3)

The Staff Dashboard is everything staff see and decide in the Rating System: reviewing held votes and alerts, looking into a student, and seeing how the system is doing across campus. The Data Engine produces scores, risk levels and reasons; **staff make every decision**, and each decision feeds back into the engine.

---

## 1. Access

| Item | Rule |
| --- | --- |
| Login | Staff sign in with their 42 Amman staff alias and an emailed code, like students |
| Access level | All staff have the same access |
| Identity log | Every time a staff member opens a voter's identity, it is logged (who, when, which case) |

## 2. Screens

| Screen | Purpose |
| --- | --- |
| Review queue (home) | Everything waiting for a staff decision |
| Case view | One held vote, alert or detected group, with everything needed to decide |
| Student profile | One student as a rated student and as a voter |
| Campus overview | How ratings and the review process look across campus |
| Settings | Limits, thresholds, labels and flag reasons |
| Activity log | Every decision, settings change and identity access |

---

## 3. Review queue

The first screen staff see. Each item shows the voted student, the reason in one line, the age of the case, and its level.

**Order**

| Priority | What | Source |
| --- | --- | --- |
| 1. Urgent | Aggressive behavior, Bad Evaluator, Didn't understand their own code | Immediate alert |
| 2. High risk | Votes the engine held because of a detected pattern | Risk level High |
| 3. Held 1-star votes | Every other 1-star vote | Review |
| 4. Repeat alerts | The same flag 3 times within a month on one student | Repeat alert |
| 5. Notices | Votes that counted but look unusual | Risk level Medium |

Within each level, the oldest case comes first.

**Groups.** Votes caught by the same pattern (a pile of low votes, a voting wave, pair voting) appear as **one case**, not one item per vote, so staff handle a coordinated attack in one place.

## 4. Case view

| Section | Contents |
| --- | --- |
| The vote(s) | Stars, category, role (After evaluation), chips, explanation, time, status |
| Why it's here | The engine's reason in plain words, e.g. "4 low votes in 2 hours from students who usually vote together" |
| The voter | Integrity, flag confirmation rate, how they usually vote, recent votes |
| The voted student | Score, dimension summary, previous flags and how they were decided |
| Related votes | Other votes in the same pattern or on the same student this month |
| Notes | Private staff notes on the case |

The voter's identity is hidden until a staff member chooses to reveal it; revealing it is logged.

## 5. Staff decisions

| Decision | Applies to | Effect (handled by the Data Engine) |
| --- | --- | --- |
| Confirm | A held vote | Counts; voter integrity rises; score updates at the next weekly run |
| Reject | A held vote | Excluded; voter integrity drops; score unchanged |
| Reject counted vote | A vote that already counted | Excluded; voter integrity drops; score recalculated |
| Dismiss | An alert or notice | No change |
| Decide group | A detected group | Confirm or reject every vote in the case at once |
| Open conversation | A serious flag or a pattern needing follow-up | Marks the case for an in-person conversation (section 9) |

Every decision is saved with the staff member, the time and a short reason.

---

## 6. Student profile

**As a rated student**
- Overall score, whether it is shown to the student yet, and number of different raters
- Monthly trend
- Six dimensions, one row each, with the share of ratings carrying a positive label and the share carrying a negative one:

| Dimension | Positive | Negative |
| --- | --- | --- |
| Help | Helpful | — |
| Teamwork | Good teammate | Unreliable teammate |
| Contribution | Community contributor | — |
| Conduct | Respectful | Disruptive, Aggressive behavior, Disrespectful |
| Evaluator quality | Fair, Thorough, Clear explainer, Helpful feedback | Rushed, Late, Bad Evaluator, Unprepared, No-show |
| Evaluation readiness | Well prepared, Knows their code, Open to feedback | Late, Defensive, Didn't understand their own code, Unprepared, No-show |

- Selecting a row lists the votes behind it
- Flags received, by reason and outcome (confirmed, rejected, pending)

**As a voter**
- Integrity and flag confirmation rate
- How they usually vote (average stars, spread)
- Votes given, by category
- Patterns they were detected in

**Also on the profile:** open cases, past conversations and their outcome, staff notes.

## 7. Campus overview

| View | What it shows |
| --- | --- |
| Score distribution | How scores spread across campus |
| Dimensions | Each dimension's positive and negative share across campus, month by month |
| Flag reasons | How often each reason is used; heavy use of "Other" means a reason is missing |
| Participation | Votes per week, by category; share of students who voted |
| Review health | Open cases, average time to a decision, share of held votes that staff confirmed |

## 8. Settings

| Setting | Initial value |
| --- | --- |
| Community votes per week | 3 |
| After evaluation votes per week | No limit |
| Same student | Once per week in each category |
| Minimum different raters before a score is shown | 5 |
| New counted votes needed for a public update | 5 |
| Age at which a vote's influence is halved | About 8 weeks |
| Repeat alert | 3 times within a month |
| Labels and flag reasons | As defined in the Voting Gate |

Every change is recorded with who made it, when, and why.

---

## 9. Process rules

These are rules for how staff use the system. The dashboard records each step.

1. **Conversation before any penalty.** No penalty is applied from the dashboard alone. A serious case leads to an in-person conversation where the student can present their side.
2. **Questioning both sides.** For urgent flags, staff speak with both the flagger and the flagged student. The flagger's identity is never shared with the flagged student.
3. **Two staff for a penalty.** A penalty needs agreement from at least two staff members. The dashboard records both, the reason, and the student's statement.
4. **Small and temporary penalties.** Penalties are limited in size and have an end date, recorded on the case.
5. **Rejected votes are kept,** marked as rejected, for the audit trail. The voter is not told the outcome of individual votes.
6. **Everything is logged:** decisions, settings changes and identity access.

## 10. Privacy

- Staff see full detail: voters, explanations, flags, integrity and all metrics.
- Students see none of this. The dashboard is staff-only.
- Voter identities are hidden by default in case views and revealed on demand, with a log entry.

---

## 11. Hand-offs

### To the Data Engine
- Staff decisions and their reasons (section 5)
- Settings changes (section 8)

### To the Voting Gate
- Settings that change what students see: limits, labels and flag reasons

### Needed from the Data Engine
- Held votes, alerts and notices, with risk level and plain-words reason
- Detected groups as single cases
- Scores, trends, dimension shares and label counts per student
- Integrity, flag confirmation rate and voting habits per voter
- Campus-wide metrics

### Needed from the Voting Gate
- Categories, roles, labels, flags and their dimensions
