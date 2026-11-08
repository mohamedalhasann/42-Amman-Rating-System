# 42 Amman Rating System — Anti-Abuse Presentation Slides

**Format:** 5–8 Minute Hackathon Demo & Presentation  
**Target Audience:** 42 Amman Technical Staff & Evaluators  
**Speaker:** Anti-Abuse System Lead  

---

## Slide 1: Title & The Peer-Review Challenge

### 🛡️ Intelligent Anti-Abuse in Peer Education
**Beyond Generic AI: Context-Aware Protection for 42 Amman**

* **The Core Problem**: Rating systems in collaborative schools face unique human challenges:
  * Friendship cartels trading 3-star ratings.
  * End-of-window deadline rushes causing false spikes.
  * Peer evaluation friction escalating into retaliatory downvotes.
* **Our Mission**: Build an anti-abuse engine that protects students from real abuse **without false-flagging legitimate teamwork**.

> **Speaker Note (30s)**:  
> *"In peer-to-peer schools like 42, naive abuse detection fails. If you set simple vote thresholds, you flag real hackathon teams as cartels and you flag deadline rushes as spam. We built an intentional, context-aware anti-abuse system that understands 42 culture, backed by clean mathematical models and full staff control."*

---

## Slide 2: Core Philosophy — The 3 Pillars

```
+---------------------------------------------------------------+
|                      OUR 3 PILLARS                            |
+-------------------------------+-------------------------------+
|  1. Immediate Vote Lifecycle  | Votes count immediately.      |
|                               | Zero pre-approval bottlenecks.|
+-------------------------------+-------------------------------+
|  2. Mathematical Telemetry    | Dynamic campus density,       |
|                               | graph topology & rush guards. |
+-------------------------------+-------------------------------+
|  3. Reversible Invalidation   | Staff-in-the-loop with 1-click|
|                               | rating recovery & audit logs. |
+-------------------------------+-------------------------------+
```

* **No Pre-Approval Queue**: Students get immediate feedback; suspected votes count until staff confirms abuse.
* **No "AI Lie-Detector" Illusions**: We provide factual telemetry and let staff evaluate human context.

> **Speaker Note (45s)**:  
> *"Our first major design choice: all votes count immediately. There are no held queues blocking students. Instead, our engine runs in the background. When abuse is detected, it opens a dossier for staff. If confirmed, staff clicks Invalidate, and the victim's score instantly recovers."*

---

## Slide 3: Directional Attacks vs. Circular Cartels

We mathematically separated directional mobbing from circular boosting:

### A. Directional Mob Attack (Rule 3)
* **Pattern**: Multiple students $\rightarrow$ 1 target (synchronized 1-star attack).
* **Detection**: $\ge 3$ distinct students targeting 1 peer within 60 minutes.
* **Result**: **Red Alert** — surfaces the exact list of coordinated attackers.

### B. Circular Cartel Ring (Rule 5)
* **Pattern**: Closed loop trading reciprocal 3-star ratings across windows.
* **The Challenge**: Distinguishing real project teammates from cartels.
* **Our Solution**:
  * **Single-window groups are EXEMPT** (protects *ft_transcendence* teams).
  * **Cross-window core overlap ($\ge 3$)** catches persistent rings even if they recruit new members.

```
       DIRECTIONAL MOB                     CIRCULAR CARTEL
    Alice \                              Student A <---> Student B
    Bob   ---> [Target Student]              ^             ^
    Charlie /                                \--- Student C /
 (3 voters in 60m = Alert)              (Shared core across sprints)
```

> **Speaker Note (60s)**:  
> *"Many systems confuse group attacks with friendship rings. We separated them. Directional mobbing catches 3+ students attacking one peer in an hour. Circular boosting catches closed rings trading 3-stars across sprints, but with a crucial innovation: single-window teams are protected, so your ft_transcendence teammates never get flagged as a cartel."*

---

## Slide 4: Real-World Nuance — De-escalation & Asymmetry

### 1. Pair Voting / Revenge (Rule 4)
* **The Reality**: Alice and Bob had a rough evaluation; both gave 1 star.
* **Our Approach**: **Neutral Advisory Note (`advisory_only=True`)**.
* Avoids accusatory red badges; shows both explanations side-by-side so staff can mediate without prejudice.

### 2. Extreme Voter Asymmetry (Rule 7)
* **1-Star Extreme**: $\ge 4$ votes of 100% 1-stars $\rightarrow$ **High-Severity Alert** (Toxic Serial Negative Voter).
* **3-Star Extreme**: Normal peer gratitude is protected! Only triggers after $\ge 10$ unvaried votes as an **Informational Note**, ensuring 100% hackathon rubric coverage without penalizing positive students.

> **Speaker Note (45s)**:  
> *"We handled human dynamics with nuance. Mutual 1-star ratings aren't labeled 'abuse'—they're surfaced as neutral dispute notes. And for extreme voters, we created an asymmetric model: serial 1-star toxicity triggers an alert at 4 votes, but peer gratitude is protected, only noting 3-star patterns after 10 votes."*

---

## Slide 5: Deadline Rush Protection & Dynamic Concentration (Rule 1)

**Why static thresholds fail**: 5 votes on Bob at 3:00 PM is suspicious. 5 votes on Bob at 8:50 AM right before the deadline is normal.

```
                     CAMPUS VOTING TRAFFIC
VOTES
  ^                                                /\ [DEADLINE RUSH]
  |                                               /  \  Thresholds:
  |                                              /    \ Min: 6 voters
  |           _/\_                              /      \ Conc: 25%
  |   _/\_   /    \  [NORMAL HOURS]            /        \
  |  /    \_/      \ Thresholds:              /          \
  | /               \ Min: 4 voters          /            \
  |/                 \ Conc: 35%            /              \
  +----------------------------------------+----------------+----> TIME
                                    WINDOW CLOSES (Last 2h)
```

* Computes target concentration: $\text{Ratio} = \frac{V_{\text{target}}}{V_{\text{campus}}}$
* If window is in its final 2 hours, rush mode activates automatically, preventing false alarms.

> **Speaker Note (45s)**:  
> *"During the final 2 hours of any sprint, voting volume spikes across the entire school. If an engine uses static thresholds, staff gets flooded with false bulk-voting tickets. Our engine calculates campus concentration and automatically activates rush protection in the final 2 hours."*

---

## Slide 6: Clean Architecture & Separation of Concerns (Rule 6 & 8)

### Architectural Boundaries (Rule 6: Too Fast / Too Often)
* **Quotas (`max_votes`)** belong at the **Database Constraint Layer**.
* **Machine velocity (bots)** belongs at the **Network Gateway (Nginx / HTTP 429)**.
* We keep the human staff dashboard free of redundant infrastructure noise.

### Transparent Staff Docket (Rule 8: Malicious Serious Votes)
* We refuse to sell fake "AI lie detectors".
* Every 1-star vote enters a dedicated staff docket.
* Staff reviews the flags/text, talks to students, and clicks **Invalidate Vote** to restore the score.

> **Speaker Note (45s)**:  
> *"We adhered to strict architectural separation of concerns. Hard limits belong in database validation, and bot velocity belongs at Nginx. In our staff review UI, we don't pretend an AI can detect lies. Instead, every 1-star serious accusation enters a dedicated docket where staff can investigate and invalidate fake claims with one click."*

---

## Slide 7: Live Calibration & Demonstration (Decision D15)

### Centralized Staff Controls
* All thresholds are runtime-configurable via `AntiAbuseSettings` and `GET / PATCH /api/v1/staff/abuse-settings`.
* Staff can calibrate sensitivity live on stage:

```json
{
  "bulk_votes_concentration": 0.35,
  "mob_attack_min_students": 3,
  "boosting_min_group_size": 3,
  "extreme_voter_min_sample": 4,
  "extreme_voter_min_positive_sample": 10
}
```

* **Live Demo Steps (5-Minute Script)**:
  1. Show clean staff queue with 0 cases.
  2. Simulate 3 students attacking 1 target with 1-star $\rightarrow$ **Mob Attack alert fires instantly**.
  3. Show victim's star average dropped.
  4. Staff clicks **"Invalidate Rating"** with reason $\rightarrow$ Victim's average instantly recovers!
  5. Show settings panel: change threshold live without restart.

> **Speaker Note (60s)**:  
> *(Switch to browser and perform the live demo).*  
> *"Here is our live dashboard. Watch as 3 accounts submit 1-star ratings against Bob. The system immediately captures the mob attack. Notice Bob's average is 1.0. Staff reviews the dossier, confirms abuse, and clicks Invalidate. Immediately, Bob's average recovers, and the audit log records the staff decision."*

---

## Slide 8: Technical Excellence & Test Verification

```
+---------------------------------------------------------------+
|                    AUTOMATED TEST SUITE                       |
+---------------------------------------------------------------+
|  17 Comprehensive Automated Tests                             |
|  100% Passing in Django TestCase Suite                        |
|  Average Execution Time: ~20 seconds                          |
+---------------------------------------------------------------+
|  * Target concentration & rush immunity tests                 |
|  * Cross-window cartel & core-overlap graph tests             |
|  * Asymmetric extreme voter & reconciliation tests            |
|  * Staff invalidation & rating recalculation tests            |
|  * Complete REST API contract integration tests               |
+---------------------------------------------------------------+
```

### Key Deliverables:
* Complete plug-and-play package: `backend/apps/abuse_detection/`
* Comprehensive Integration Guide: `INTEGRATION_GUIDE.md`
* Master Technical Report: `docs/reports/anti-abuse-master-report.md`

> **Speaker Note (30s)**:  
> *"Every single mechanism is backed by automated tests—17 test cases running in under 20 seconds with 100% pass rate. We have delivered a complete, production-ready integration guide for both backend and frontend teams. Thank you, and we welcome your questions."*

---

## Slide 9: Evaluator Q&A Defense Cheat Sheet (Be Ready for These!)

| Likely Judge Question | Your Winning Answer |
| :--- | :--- |
| **"Why don't you hold 1-star votes in a queue before counting them?"** | *"Because a pre-approval queue creates an administrative bottleneck for staff, corrupts real-time student averages, and violates the official hackathon specification which explicitly requires all accepted votes to count immediately until invalidated."* |
| **"How does your system know if a 1-star explanation is an invented lie?"** | *"No software can detect real-world truth, and claiming an AI can is bad engineering. Our system surfaces every 1-star vote into an Incident Docket with voter history, and gives staff the 1-click Invalidation tool once they verify the facts."* |
| **"What if real teammates give each other 3 stars on a hackathon project?"** | *"Our Friends Boosting detector explicitly exempts single-window interactions. It only flags if the exact same core group of 3+ students repeatedly trade mutual high ratings across multiple consecutive sprints."* |
| **"Where is 'Too fast or too often' in your dashboard?"** | *"We applied clean separation of concerns: quotas are hard database constraints (`max_votes`), and velocity bursts are throttled at the Nginx API gateway (`429`), keeping the human review queue free of redundant spam tickets."* |
