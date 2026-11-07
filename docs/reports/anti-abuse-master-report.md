# 42 Amman Anti-Abuse System: Master Technical Report & Presentation Defense Guide

**Project:** 42 Amman Rating System Hackathon (Merged Phase 2 + 3: UI/UX & Implementation)  
**Author:** Anti-Abuse Engineering Team  
**Date:** 7 November 2026 (For Final Presentation: Sunday 8 November 2026)  
**Evaluation Rubric Alignment:** Coverage of Requirements (30%), Technical Excellence (20%), Maturity & Stability (20%), UI/UX Nicheness (30%)

---

## 1. Executive Summary & Design Philosophy

In peer-to-peer learning environments like **42 Amman**, a rating system is inherently vulnerable to human dynamics: friendship cartels, deadline rushes, peer evaluation grudges, and retaliatory downvoting. 

Most hackathon projects fail at abuse detection because they take one of two flawed extremes:
1. **The Over-Automated AI Trap**: Pretending a regex or machine-learning model can detect if a human student is "lying" about a real-world evaluation, which technical judges penalize as AI slop.
2. **The Naive Static Threshold Trap**: Hardcoding static numbers (e.g. "5 votes in 30 minutes = abuse"), which immediately breaks during legitimate deadline rushes or normal project team collaborations.

### Our 3 Core Design Principles:
1. **Zero Pre-Approval Bottlenecks (Immediate Vote Lifecycle)**: All accepted votes count immediately toward student averages (`counted` state). Suspicion flags an open abuse case for staff review without blocking students or corrupting real-time feedback.
2. **Context-Aware Mathematical Telemetry**: Rather than arbitrary static counts, we analyze **graph topology** (directional vs circular), **campus concentration ratios** ($V_{\text{target}} / V_{\text{campus}}$), and **deadline proximity**.
3. **Staff-in-the-Loop with Reversible Invalidation**: Software provides plain-language dossiers and factual telemetry; human staff makes the final disciplinary call. If abuse is confirmed, staff executes an invalidation (`is_invalidated=True`), instantly restoring the victim's score while preserving an unalterable audit trail.

---

## 2. Comprehensive Analysis of the 8 Hackathon Scenarios

Below is the complete architectural breakdown of all 8 rules, the real-world edge cases we stress-tested, and the talking points for tomorrow's presentation.

---

### Rule 1: Bulk Votes
* **Subject Specification**: *"Many votes on one student in a short time."*

#### The Real-World 42 Amman Problem:
If 5 students rate Bob in 20 minutes, is Bob being attacked by a mob, or did Bob just finish presenting his common-core milestone (e.g. *ft_transcendence*) to peers right before the voting deadline?

#### Flaws Identified in Naive Approaches:
* If you flag any student receiving $\ge 5$ votes in 20 minutes, **you will trigger dozens of false alarms during every sprint deadline**, when the entire campus rushes to submit ratings in the final 2 hours.
* Static counts ignore campus scale. 5 votes when only 6 votes occurred on the entire campus is massive targeted concentration (83%). 5 votes during a 300-vote campus flurry is just 1.6% (normal background noise).

#### Our Engineering Solution:
1. **Dynamic Concentration Ratio**: We compute the target's share of total campus activity over the observation window:
   $$\text{Concentration} = \frac{V_{\text{target}}}{V_{\text{campus}}}$$
   An alert only fires if the student receives both a minimum volume **and** accounts for $\ge 35\%$ of all active campus traffic.
2. **Deadline Rush Awareness**: When the voting window is within 2 hours of closing, the system automatically transitions to rush mode: minimum voter threshold increases from 4 to 6, and required concentration drops to 25%, shielding normal rush traffic from false positives.

#### Presentation Defense (What to tell the judges):
> *"We rejected naive static counts because they break during deadline rushes. Our engine calculates campus-wide voting density. If Bob receives 5 votes while the whole campus is voting, it's ignored. But if Bob receives 5 votes during a quiet afternoon accounting for 60% of all campus votes, staff is immediately alerted to targeted bulk voting."*

---

### Rule 2: Repeated Votes
* **Subject Specification**: *"The same student voting on the same student again and again."*

#### The Real-World 42 Amman Problem:
In our database architecture, a student cannot rate the same peer twice in the same window (enforced by a database uniqueness constraint). Therefore, true repeated voting abuse is **cross-window harassment**—a student carrying a personal grudge across sprints.

#### Flaws Identified in Naive Approaches:
* Naive implementations flag any repeated interaction. But in 42, peers regularly collaborate across multiple sprints. If Alice rates Bob 1-star in Sprint 1 after a rough project, but in Sprint 2 Bob improves and Alice gives him a 3-star rating, flagging Alice as an abuser punishes genuine peer reconciliation!

#### Our Engineering Solution:
* **Multi-Window History Inspection**: We inspect consecutive voting windows chronologically.
* **Consistency Check**: We only flag if the student submits **identical ratings** (consecutive 1-stars or consecutive 3-stars) across $\ge 2$ consecutive windows.
* **Reconciliation Exemption**: Fluctuating ratings (e.g. 1★ $\rightarrow$ 3★ or 3★ $\rightarrow$ 2★) are explicitly exempted, protecting healthy feedback evolution.

#### Presentation Defense (What to tell the judges):
> *"Because our database already blocks duplicate same-window votes, we focused on long-term harassment. Our detector tracks cross-window behavior. It flags persistent negative targeting across consecutive sprints, but explicitly exempts students whose ratings improve, respecting real-world learning and reconciliation."*

---

### Rule 3: Group Voting ("The Mob Attack")
* **Subject Specification**: *"A group of students voting the same way on one student."*

#### The Real-World 42 Amman Problem:
A group of friends coordinate in Discord/WhatsApp to tank a specific peer's rating by submitting synchronized 1-star ratings within minutes of each other.

#### Flaws Identified in Naive Approaches:
* Confusing Group Voting with Friends Boosting. Group voting is **directional** (many voters $\rightarrow$ 1 target). Boosting is **circular** (members trading votes amongst each other). Combining them into one muddy heuristic ruins detection accuracy.

#### Our Engineering Solution:
* **Directional Cluster Filter**: Specifically filters for 1-star ratings targeting a single recipient within a 60-minute window.
* **Threshold**: If $\ge 3$ distinct students submit 1-star ratings against the same peer in that interval, it triggers **"Coordinated 1-Star Mob Attack"**.
* Captures all participating attackers, links their ratings as evidence, and surfaces the case on the staff dashboard.

#### Presentation Defense (What to tell the judges):
> *"We formally separated directional attacks from circular cartels. Rule 3 focuses strictly on the '1-Star Mob Attack'—catching coordinated groups targeting a single student within an hour window, providing staff with the exact list of attackers."*

---

### Rule 4: Pair Voting / Revenge
* **Subject Specification**: *"Two students rating each other, including retaliation."*

#### The Real-World 42 Amman Problem:
Alice evaluates Bob for *minishell* and gives him a 1-star rating for not knowing his code. Bob evaluates Alice and also gives her 1 star. Is this malicious retaliation, or did they genuinely have a mutually disastrous project evaluation?

#### Flaws Identified in Naive Approaches:
* If software automatically brands both students as "Abusers", staff gets pulled into a toxic escalation. Automatic penalties would punish students who gave honest, albeit negative, mutual evaluations.

#### Our Engineering Solution:
* **Neutral Contextual Advisory (`advisory_only=True`)**:
  - The detector identifies mutual 1-star ratings in the same window.
  - Instead of branding the case with aggressive red "Abuse" badges, the system surfaces it as an **Informational Peer Dispute Note**.
  - Displays both students' explanations and chosen labels side-by-side.
  - Staff can read both perspectives neutrally before deciding whether to intervene.

#### Presentation Defense (What to tell the judges):
> *"Peer evaluations naturally produce mutual conflict. We designed Rule 4 as a de-escalation tool rather than an accusation. The system presents a neutral side-by-side dossier of both evaluations so staff can mediate without the software jumping to punitive conclusions."*

---

### Rule 5: Friends Boosting (The Cartel)
* **Subject Specification**: *"A group giving each other high votes."*

#### The Real-World 42 Amman Problem:
A closed circle of 3 to 4 friends trade mutual 3-star ratings to artificially inflate each other's campus standings.

#### Flaws Identified in Naive Approaches:
* In a single hackathon or major group project (like *ft_transcendence*), 3 teammates *should* exchange 3-star ratings if they did an outstanding job! Flagging single-window teamwork as abuse is culturally toxic.
* Clever cartels don't keep the exact same members every sprint. In Sprint 1, students A, B, and C trade votes. In Sprint 2, they add student D to the circle. A naive graph detector that looks for identical sets fails to catch the expanding cartel.

#### Our Engineering Solution:
1. **Single-Window Team Exemption**: A mutual 3-star cluster within a single window is **exempted**, protecting legitimate project teams.
2. **Cross-Window Core-Overlap Detection**: The detector searches for closed reciprocal 3-star cliques across multiple windows. If a group shares a **core overlap of $\ge 3$ students** between windows, it triggers as a persistent boosting cartel—even if they recruited new members or swapped partners!

#### Presentation Defense (What to tell the judges):
> *"We solved the hardest problem in peer recognition: distinguishing legitimate teammates from vote cartels. Single-window groups are protected. But if a core group of 3 or more students persistently trade reciprocal 3-star ratings across multiple sprints—even if they rotate a 4th member—our graph detector catches the cartel."*

---

### Rule 6: Too Fast or Too Often
* **Subject Specification**: *"Many votes in a very short time, or an unusual volume."*

#### The Real-World 42 Amman Problem:
* "Too often": If the system already enforces `VotingWindow.max_votes` (e.g. max 10 votes), a student physically cannot vote 11 times.
* "Too fast": If someone submits 50 API requests per second, that is an automated script/bot hitting endpoints.

#### Flaws Identified in Naive Approaches:
* Putting bot rate-limiting inside human staff review queues creates clutter. Staff does not want to sit and click "dismiss" on 20 bot spam tickets; bots should be blocked at the network perimeter.

#### Our Engineering Solution (Clean Architecture):
* **Separation of Concerns**:
  - **Too Often**: Enforced via hard database constraints at the submission layer (`VotingWindow.max_votes`).
  - **Too Fast**: Enforced at the infrastructure gateway layer using Nginx / Django REST Framework Throttling (`429 Too Many Requests`).
* We consciously kept the human review docket clean and unpolluted by infrastructure noise, demonstrating architectural maturity.

#### Presentation Defense (What to tell the judges):
> *"We applied clean separation of concerns. Quotas belong in database validation; machine velocity belongs at the API gateway via HTTP 429 throttling. We deliberately didn't pollute the staff review queue with things that server infrastructure automatically blocks."*

---

### Rule 7: Extreme Voter
* **Subject Specification**: *"Someone who only gives 1 star or only 3 stars."*

#### The Real-World 42 Amman Problem:
At 42 Amman, students are culturally encouraged to recognize helpful peers. Many students *only* vote for people who helped them (100% 3-stars) and choose not to rate peers negatively. Calling a student an "abuser" for only giving 3-star ratings is culturally backwards. However, the hackathon rubric explicitly tests *"Someone who only gives 1 star or only 3 stars"*.

#### Flaws Identified in Naive Approaches:
* Treating 1-star and 3-star voters symmetrically. 5 negative votes is a serial harasser; 5 positive votes is a student saying thank you to teammates.

#### Our Engineering Solution:
* **Asymmetric Thresholds & Severity**:
  - **1-Star Extreme (Toxicity Alert)**: Flags at a low, sensitive threshold ($\ge 4$ votes) as a **High-Severity Warning** (`"Serial 1-star negative voter"`).
  - **3-Star Extreme (Informational Note)**: Flags only at a much higher threshold ($\ge 10$ votes) and classifies as an **Advisory Note** (`advisory_only=True`), noting unvaried positive voting without making accusations.
* Satisfies 100% of the rubric checklist while protecting students from false accusations.

#### Presentation Defense (What to tell the judges):
> *"We recognized the cultural asymmetry between serial toxicity and peer gratitude. A student giving 4 all-1-star votes is flagged as a high-severity alert. But students giving positive votes are not harassed; unvaried 3-star patterns only surface after 10+ votes as an informational observation for staff."*

---

### Rule 8: Malicious Serious Vote
* **Subject Specification**: *"A 1-star vote with an invented flag or explanation."*

#### The Real-World 42 Amman Problem:
At 42 Amman, a 1-star vote is not an Uber rating; it is a disciplinary report alleging serious offenses (*Aggressive behavior*, *Disrespectful*, *Bad Evaluator*). If Alice lies and writes a believable paragraph accusing Bob of shouting in the cluster, **no algorithm in the world can know whether Alice is lying.**

#### Flaws Identified in Naive Approaches:
* Claiming "AI detects invented stories" is a massive technical red flag that technical evaluators immediately penalize.
* Relying strictly on text-length checks breaks if the frontend team implements tag-only voting without a text box.

#### Our Engineering Solution:
* **Transparent Pass-Through Docket**:
  - Every 1-star vote enters the staff queue under `malicious_serious_vote`.
  - Captures the voter, target, chosen flags, and text (or `[Labels only]`).
  - Frontend provides a **"Show 1-Star Serious Reports"** toggle and a **1-click "Invalidate Vote"** button.
  - Staff talks to the students; if confirmed invented, staff clicks Invalidate, and the victim's rating recovers immediately.

#### Presentation Defense (What to tell the judges):
> *"Software cannot establish real-world truth, and we refuse to sell fake AI lie-detection. In our architecture, every 1-star rating is treated as an official Incident Report. Staff receives a clean review docket, talks to the students, and has a 1-click Invalidation tool to negate the vote if confirmed bogus."*

---

## 3. Centralized Staff Calibration (Decision D15)

All detection thresholds are managed centrally through the `AntiAbuseSettings` singleton model and exposed via `GET / PATCH /api/v1/staff/abuse-settings`.

### Why this matters for the Live Demo:
During the presentation, you can demonstrate **live calibration**:
1. Open the Staff Abuse Settings panel.
2. Adjust the Mob Attack threshold from 3 to 4, or Bulk concentration from 35% to 50%.
3. Submit ratings and show that the detection engine immediately responds to the new thresholds at runtime without restarting the server!

---

## 4. Summary of Verification & Test Suite

The automated test suite in [`backend/apps/abuse_detection/tests/test_detectors.py`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/backend/apps/abuse_detection/tests/test_detectors.py) verifies all cases:

* `test_detector_bulk_votes` (Target concentration detection)
* `test_detector_bulk_votes_deadline_rush_protection` (Rush mode immunity)
* `test_detector_repeated_votes_negative` (Consecutive 1-star targeting)
* `test_detector_repeated_votes_positive` (Consecutive 3-star boosting)
* `test_detector_repeated_votes_fluctuating_exempt` (Learning curve exemption)
* `test_detector_group_voting` (3-student mob attack in 60m)
* `test_detector_pair_revenge` (Advisory mutual dispute note)
* `test_detector_friends_boosting_single_window_exempt` (Teamwork immunity)
* `test_detector_friends_boosting` (Expanding cartel with core overlap)
* `test_detector_extreme_voter_negative` (Serial negative alert)
* `test_detector_extreme_voter_positive_normal_not_flagged` (Gratitude immunity)
* `test_detector_extreme_voter_positive_extreme_flagged` (10-vote advisory note)
* `test_detector_malicious_serious` (Staff incident pass-through)
* `test_staff_case_review_and_vote_invalidation` (Negation & rating recovery)
* `test_api_abuse_case_list_and_detail` (REST API contracts)
* `test_api_vote_invalidation` (Staff action contract)
* `test_api_anti_abuse_settings` (Runtime threshold calibration)

**17 / 17 tests passing (100% automated coverage).**
