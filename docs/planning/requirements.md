# Requirements and acceptance checks

Source: [42_Amman_Rating_System_Next_Phase.pdf](../42_Amman_Rating_System_Next_Phase.pdf), pages 1 and 2. Device scope comes from the two supporting experience PDFs. IDs below are planning references, not IDs from the PDF.

| ID | Required behavior | Acceptance check |
| --- | --- | --- |
| R01 | Students rate peers with 1 to 3 stars and labels allowed for that star level. | Each star value offers permitted labels; the server rejects invalid stars and label combinations. |
| R02 | Students see only their own star average, never received labels or other students' ratings. | Student responses and screens contain no other student's rating or any received labels. |
| R03 | Students see votes remaining and a deadline timer. | Both reflect staff configuration and the server's voting deadline. |
| R04 | Staff see total ratings, students who rated, and students who did not. | Dashboard totals reconcile with the selected voting window and participation list. |
| R05 | Staff see who rated and each student's number of votes, including participation in a specific window. | Lists include students with zero votes and per-student counts. |
| R06 | Staff inspect whom each student rated, who rated them, labels received, and their rating. | Student detail exposes both vote directions and label information to staff. |
| R07 | Staff group ratings by label, stars, or student. | Each grouping can be requested and reconciles with its underlying votes. |
| R08 | Staff add, remove, or control labels. | Staff can manage labels and their star availability. |
| R09 | Staff configure minimum and maximum votes for a window. | Limits persist and the submission flow respects the agreed policy. |
| R10 | Staff set and change voting windows at any time. | Updated dates affect subsequent submissions and the student's countdown. |
| R11 | Staff export ratings as CSV. | Staff can download usable CSV; students cannot access the export endpoint. |
| R12 | Detect unusual voting and show every mechanism and involved students together in one readable place. | All eight example scenarios have coverage in the abuse review plan and staff interface. |
| R13 | Staff invalidate a vote confirmed as abuse. | Confirmed invalidation excludes that vote from the rating calculation. |
| R14 | Staff analytics and controls use role-based access. | Student requests to every staff route fail on the server. |
| R15 | Secure student data; do not publicly expose identifiers. | No unauthenticated directory, rating, analytics, or export responses expose student data. |
| R16 | Student interface supports PC and mobile; staff interface supports PC. | Core flows are usable at the agreed device sizes. Supporting PDF scope. |
| R17 | Team designs and implements its own intentional UI/UX and anti-abuse approach; seek staff feedback early and often. | Team records design choices, detection choices, and feedback before final delivery. |

## Example labels from the specification

These are examples from the PDF, not a fixed complete taxonomy. Staff control the label catalog.

| Stars | Meaning | Examples |
| --- | --- | --- |
| 3 | Positive impact | Helpful; Good teammate; Community contributor; Respectful; Fair; Thorough; Clear explainer; Helpful feedback; Well prepared; Knows their code; Open to feedback |
| 2 | Neutral or a small issue | Some 3-star labels; Unreliable teammate; Disruptive; Rushed; Late; Defensive |
| 1 | Serious issue | Aggressive behavior; Disrespectful; Bad Evaluator; Unprepared; small-issue labels are also available |

The PDF does not identify which positive labels are allowed at 2 stars. Do not silently map all positive labels to 2 stars.

## Evaluation and delivery

| Criterion | Weight |
| --- | --- |
| Coverage of requirements | 30% |
| UI/UX nicheness | 30% |
| Technical excellence | 20% |
| Maturity and stability | 20% |

Required delivery: repository and live demo, with a 5 to 8 minute presentation plus Q&A. Submit links by Sunday 8 November 2026 at 9:00 AM. Final demos are at 3:00 PM that day. The PDF warns that commits after the deadline, or work differing from the GitHub repository, can cause disqualification. The PDF does not specify a timezone; confirm it with staff.

## Features not mandated by the specification

Weighted ratings, voter reputation, automatic penalties, weekly resets, minimum rater thresholds, delayed score publication, student label summaries, and rating categories are not requirements. Student label summaries conflict with the stated privacy rule. None are included as baseline behavior here.
