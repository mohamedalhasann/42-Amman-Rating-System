# Voting Gate

The Voting Gate is everything a student sees and does in the Rating System: how they get in, how they vote, and what they see of their own rating. Students rate students; staff manage the process and are not rated.

---

## 1. Access

| Item | Rule |
| --- | --- |
| Login | The student enters their 42 Amman alias, receives a 6-digit code by email, and enters it |
| Code expiry | 10 minutes |
| Session | Stays logged in for 30 days |

## 2. Entry points

- **The website**, open anytime.
- **Personal rating link** for every student: `/r/<login>` opens that student's page directly. Students can share their own link (for example under a Slack post about an initiative they run).
- **Weekly reminder**: staff post the site link in Slack once a week.

---

## 3. Screens

### Home

- Search bar: "Who do you want to rate?"
- **Your rating**: the overall star rating, or "Not enough ratings yet" until it comes from at least 5 different raters.
- **Labels you've received**, with counts (e.g. "Helpful ×4").
- **Monthly trend**: shown once there are two months of data. A month gets a point only if it has at least 3 new ratings.
- **Votes left this week**, per category (e.g. "General 2 / 3 · After evaluation 7 / 10").
- While an undo is available: a banner "Undo your last vote" with the time left.

### Student page

Reached from search or a personal rating link.

- Login, name and picture. **Never a score.**
- "Rate" button.
- "You rated them on <date>" if the student has rated them before.

### Rating screen

One screen; each step appears as the previous one is answered.

1. Category: **General** (selected by default) or **After evaluation**.
2. If After evaluation: role, **They evaluated me** or **I evaluated them**.
3. Stars: 1, 2 or 3.
4. The chips and fields for that star level (see section 5).
5. Submit.

### Confirmation

- 3 or 2 stars: "Vote counted."
- 1 star: "Sent for review. Staff will check it before it counts."
- Undo button, available for 5 minutes.

---

## 4. Categories

| Category | When it's used |
| --- | --- |
| General (default) | Help, teamwork, community and conduct anywhere on campus |
| After evaluation | An evaluation between the two students; the voter picks their role |

## 5. Star rules

| Stars | What the student sees | Required | What happens |
| --- | --- | --- | --- |
| 3 | Positive labels | Nothing; labels optional | Counts right away |
| 2 | Positive labels and mild negatives | Nothing; comment optional (max 280 characters) | Counts right away |
| 1 | Flag reasons | One flag reason and an explanation (min 50 characters) | Held for staff review |

Serious flags exist only at 1 star, so they always come with an explanation and staff review.

---

## 6. Labels and flags

Every label and flag belongs to one **dimension**. Students never see dimensions; they are how staff read the data.

### General

| Chip | Type | Available at | Dimension |
| --- | --- | --- | --- |
| Helpful | Positive | 3, 2 | Help |
| Good teammate | Positive | 3, 2 | Teamwork |
| Community contributor | Positive | 3, 2 | Community |
| Respectful | Positive | 3, 2 | Conduct |
| Unreliable teammate | Negative | 2, 1 | Teamwork |
| Disruptive | Negative | 2, 1 | Conduct |
| Aggressive behavior | Flag | 1 | Conduct |
| Disrespectful | Flag | 1 | Conduct |
| Other | Flag | 1 | (explanation required) |

### After evaluation — "They evaluated me"

| Chip | Type | Available at | Dimension |
| --- | --- | --- | --- |
| Fair | Positive | 3, 2 | Evaluator quality |
| Thorough | Positive | 3, 2 | Evaluator quality |
| Clear explainer | Positive | 3, 2 | Evaluator quality |
| Helpful feedback | Positive | 3, 2 | Evaluator quality |
| Rushed | Negative | 2, 1 | Evaluator quality |
| Late | Negative | 2, 1 | Evaluator quality |
| Bad Evaluator | Flag | 1 | Evaluator quality |
| Unprepared | Flag | 1 | Evaluator quality |
| No-show | Flag | 1 | Evaluator quality |
| Other | Flag | 1 | (explanation required) |

### After evaluation — "I evaluated them"

| Chip | Type | Available at | Dimension |
| --- | --- | --- | --- |
| Well prepared | Positive | 3, 2 | Evaluation readiness |
| Knows their code | Positive | 3, 2 | Evaluation readiness |
| Open to feedback | Positive | 3, 2 | Evaluation readiness |
| Late | Negative | 2, 1 | Evaluation readiness |
| Defensive | Negative | 2 | Evaluation readiness |
| Didn't understand their own code | Flag | 1 | Evaluation readiness |
| Unprepared | Flag | 1 | Evaluation readiness |
| No-show | Flag | 1 | Evaluation readiness |
| Disrespectful | Flag | 1 | Conduct |
| Other | Flag | 1 | (explanation required) |

### Dimensions

| Dimension | Positive | Negative |
| --- | --- | --- |
| Help | Helpful | — |
| Teamwork | Good teammate | Unreliable teammate |
| Community | Community contributor | — |
| Conduct | Respectful | Disruptive, Aggressive behavior, Disrespectful |
| Evaluator quality | Fair, Thorough, Clear explainer, Helpful feedback | Rushed, Late, Bad Evaluator, Unprepared, No-show |
| Evaluation readiness | Well prepared, Knows their code, Open to feedback | Late, Defensive, Didn't understand their own code, Unprepared, No-show |

---

## 7. Handling levels

| Level | Applies to | What happens |
| --- | --- | --- |
| Counts silently | 3-star and 2-star votes, including mild negatives | Counts right away; feeds the metrics |
| Review | Every 1-star vote | Held until staff confirm or reject it |
| Immediate alert | Aggressive behavior, Bad Evaluator, Didn't understand their own code | Top of the staff queue, marked urgent |
| Repeat alert | No-show, Late, Disrespectful, Unreliable teammate, Disruptive | Alerts staff when the same student receives it 3 times within a month (counts 2-star and 1-star votes) |

## 8. Voting limits

| Limit | Value |
| --- | --- |
| General votes per week | 3 |
| After evaluation votes per week | 10, counted separately from General |
| Same student | Once per week in each category |
| Rating yourself | Not allowed |
| Week resets | Sunday |

Staff can change these values from the dashboard. The Data Engine enforces them; the Voting Gate shows them.

## 9. Undo

- Available for 5 minutes after submitting, on the confirmation screen and as a banner on Home.
- An undone vote is removed completely and the weekly vote is given back.

## 10. Privacy

A student can see:

- Their own overall rating (once it has 5 different raters)
- The labels they've received, with counts
- Their monthly trend

A student never sees:

- Who rated them
- Comments, explanations or flags about them
- Anyone else's rating, including in search results and on student pages

---

## 11. Blocked cases

| Situation | Message |
| --- | --- |
| No General votes left this week | "You've used your 3 General votes this week. You can vote again on Sunday." |
| No After evaluation votes left this week | "You've used your 10 evaluation votes this week. You can vote again on Sunday." |
| Already rated this student in this category this week | "You've already rated them this week. You can rate them again next week." |
| Trying to rate yourself | The Rate button doesn't appear on your own page |
| 1 star without a flag reason | "Pick a reason to continue." |
| Explanation under 50 characters | "Tell us a bit more (at least 50 characters)." |
| Expired login code | "That code expired. We sent you a new one." |

## 12. Full student flow

1. The student opens the site, follows the weekly reminder, or follows someone's personal rating link.
2. If not logged in: enter the 42 Amman alias → enter the emailed code.
3. **Home**: sees their rating, labels, trend and votes left.
4. Searches for a student (or arrives on their page from a link) → **Student page**.
5. Taps **Rate** → **Rating screen**: category → role (if After evaluation) → stars → chips and fields → Submit.
6. **Confirmation**: "Vote counted" or "Sent for review". Undo is available for 5 minutes.
7. Back to Home, with one fewer vote left this week in that category.

---

## 13. Hand-offs

### To the Data Engine

Each submitted vote contains:

| Field | Values |
| --- | --- |
| Voter | Login |
| Voted student | Login |
| Category | General, After evaluation |
| Role | They evaluated me, I evaluated them (After evaluation only) |
| Stars | 1, 2, 3 |
| Chips | Selected labels or flag |
| Comment / explanation | Text |
| Time | Timestamp |
| Undone | Yes / no |

Also handed over: the categories, star rules, label and flag lists with their dimensions, handling levels and voting limits defined above.

### To the Staff Dashboard

- Categories, roles, labels, flags and dimensions (for filters and student profiles)
- Handling levels (which flags alert immediately, which alert on repeat)

### Needed from the Data Engine

- Each student's overall rating and whether it has reached 5 different raters
- Monthly trend points
- Label counts per student
- Votes left this week for the logged-in student, per category
- Whether a vote is allowed, and which blocked case applies if not
