# Anti-Abuse System — Complete Integration Guide

**Workstream:** Anti-Abuse System (Backend & Frontend Handoff)  
**Package:** `backend/apps/abuse_detection/`  
**Compatibility:** Django 5+, Django REST Framework, PostgreSQL / SQLite  
**Test Status:** 17 Tests Passing (100% automated coverage)

---

## 1. System Overview & The 8 Hackathon Scenarios

The anti-abuse engine covers all 8 scenarios specified in the **42 Amman Rating System Hackathon Specification** (`42_Amman_Rating_System_Next_Phase.pdf`, Page 2). It combines real-time synchronous hooks (evaluating submissions instantly) with asynchronous background graph scans (evaluating group rings):

| # | Hackathon Rule | Detection Method | Staff Explanation Output |
| :--- | :--- | :--- | :--- |
| **1** | **Bulk votes** | Dynamic concentration ($V_{\text{target}} / V_{\text{campus}} \ge 35\%$) + **Deadline Rush Protection** (relaxes threshold in the final 2 hours). | *"Targeted bulk voting: @user received 5 votes in 20m, accounting for 50.0% of all campus voting activity."* |
| **2** | **Repeated votes** | Cross-window repetition ($\ge 2$ consecutive windows with identical 1★ or 3★ ratings). Fluctuating ratings (1★ $\rightarrow$ 3★) are exempted. | *"Persistent negative targeting: @voter submitted identical 1-star ratings across 2 consecutive windows."* |
| **3** | **Group voting** *(Mob Attack)* | Directional 1-star mob: $\ge 3$ distinct students casting 1-star ratings against 1 student in $\le 60$ minutes. | *"Coordinated 1-star group attack: 3 students rated @target with 1 star within 60 minutes."* |
| **4** | **Pair voting / revenge** | Mutual 1-star ratings in the same window. Tagged as `advisory_only=True` to prevent false accusations. | *"Mutual 1-star exchange in this window (Advisory note for context)."* |
| **5** | **Friends boosting** | Cross-window circular 3-star ring with **core overlap** ($\ge 3$ members). Single-window project teams are exempted. | *"Persistent 3-star boosting circle: Core members (@a, @b, @c) traded mutual 3-star ratings across sprints."* |
| **6** | **Too fast or too often** | Enforced at infrastructure/DB boundaries: Nginx/DRF rate-limiting (`429`) + window `max_votes` hard quota. | *Blocked at gateway; quotas prevented at submission layer.* |
| **7** | **Extreme voter** | Asymmetric sample sizes: $\ge 4$ votes of 100% 1-star (High-severity alert) vs $\ge 10$ votes of 100% 3-star (Informational note). | *"Serial 1-star negative voter: @voter cast 4 votes, giving exclusively 1-star ratings."* |
| **8** | **Malicious serious vote** | Transparent 1-star docket. No algorithmic text-guessing: surfaces 1-stars for staff to verify or invalidate. | *"1-star serious report submitted by @voter against @target. Staff verification required."* |

---

## 2. Backend Integration (Under 5 Minutes)

### Step 1: Register in `settings.py`
Add `apps.abuse_detection` to your `INSTALLED_APPS`:

```python
INSTALLED_APPS = [
    # ... django default apps
    'rest_framework',
    'apps.ratings',
    'apps.abuse_detection',
]
```

Run migrations:
```bash
python manage.py migrate
```

---

### Step 2: Hook Submission Evaluation
In your rating submission view (or post-save signal), call `evaluate_vote_submission(rating)` after saving a vote:

```python
# in apps/ratings/views.py (or your submit rating endpoint)
from apps.abuse_detection.services import evaluate_vote_submission

def submit_rating_view(request):
    # 1. Your normal validation and rating creation:
    rating = Rating.objects.create(
        window=window,
        voter=request.user.student_profile,
        recipient=target_student,
        stars=stars,
        explanation=explanation,  # optional text if UI provides it
    )
    # Link any selected labels:
    rating.labels.set(selected_labels)

    # 2. TRIGGER ANTI-ABUSE INSPECTION:
    # Runs synchronous checks (revenge, bulk votes, extreme voter, malicious 1-star)
    evaluate_vote_submission(rating)

    return Response({"rating_id": str(rating.id), "status": "submitted"}, status=201)
```

> **Crucial Rule**: `evaluate_vote_submission` never raises an exception and never blocks the student. It silently records an `AbuseCase` in the background for staff review.

---

### Step 3: Wire Staff Routing in `urls.py`
In your root `urls.py`:

```python
from django.urls import path, include

urlpatterns = [
    # ...
    path('', include('apps.abuse_detection.urls')),
]
```

---

### Step 4: Correct Star Average Calculation Formula
Per 42 Amman hackathon specification, all votes count immediately **unless invalidated by staff**. In your student profile or average calculation service, ensure `is_invalidated=False` is filtered:

```python
from django.db.models import Avg

def get_student_star_average(student):
    result = Rating.objects.filter(
        recipient=student,
        is_invalidated=False  # EXCLUDE INVALIDATED ABUSE VOTES
    ).aggregate(Avg('stars'))
    
    avg = result['stars__avg']
    return round(avg, 2) if avg is not None else None
```

When staff negates a vote via the Invalidate endpoint, `is_invalidated` becomes `True`, and this formula automatically recalculates the student's true average.

---

### Step 5: Schedule the Periodic Graph Scan (Cliques & Groups)
To detect complex cross-window cartels (Rule #5 Friends Boosting) and multi-student attacks (Rule #3 Group Voting), run the periodic scan:

* **Via CLI/Cron (every 5-10 minutes)**:
  ```bash
  python manage.py scan_abuse
  ```
* **Via Staff API (on-demand)**:
  ```http
  POST /api/v1/staff/abuse-cases/scan
  ```

---

## 3. Staff REST API Contract

All endpoints are prefixed with `/api/v1/staff/`.

### 1. List Abuse Cases
```http
GET /api/v1/staff/abuse-cases?status=open
```
* **Query Params**: `status` (`open`, `confirmed`, `dismissed`).
* **Response (200 OK)**:
```json
{
  "count": 2,
  "items": [
    {
      "id": "e4b2d354-8c47-4952-b883-cf2d4c06e890",
      "status": "open",
      "summary": "Coordinated 1-star group attack on @target_student (3 voters in 60m)",
      "detected_at": "2026-11-07T14:30:00Z",
      "reviewed_at": null,
      "findings_count": 1,
      "students": [
        {"id": 1, "intra_username": "voter_a", "first_name": "Alice", "last_name": "Smith"},
        {"id": 2, "intra_username": "voter_b", "first_name": "Bob", "last_name": "Jones"},
        {"id": 3, "intra_username": "voter_c", "first_name": "Charlie", "last_name": "Brown"},
        {"id": 4, "intra_username": "target_student", "first_name": "David", "last_name": "Target"}
      ]
    }
  ]
}
```

---

### 2. Get Abuse Case Detail
```http
GET /api/v1/staff/abuse-cases/{case_id}
```
* **Response (200 OK)**:
```json
{
  "id": "e4b2d354-8c47-4952-b883-cf2d4c06e890",
  "status": "open",
  "summary": "Coordinated 1-star group attack on @target_student",
  "detected_at": "2026-11-07T14:30:00Z",
  "reviewed_by_username": null,
  "reviewed_at": null,
  "review_reason": "",
  "findings": [
    {
      "id": "f8a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "mechanism": "group_voting",
      "mechanism_display": "Group voting",
      "rule_version": "v1.0",
      "observed_from": "2026-11-07T14:00:00Z",
      "observed_to": "2026-11-07T14:30:00Z",
      "explanation": "Coordinated 1-star group attack: 3 students submitted 1-star ratings against @target_student within 60 minutes.",
      "evidence": {
        "target_username": "target_student",
        "attackers": ["voter_a", "voter_b", "voter_c"],
        "count": 3,
        "window_minutes": 60
      }
    }
  ],
  "involved_students": [
    {"student": {"id": 1, "intra_username": "voter_a"}, "role": "attacker"},
    {"student": {"id": 4, "intra_username": "target_student"}, "role": "target"}
  ],
  "evidence_ratings": [
    {
      "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "voter": {"intra_username": "voter_a"},
      "recipient": {"intra_username": "target_student"},
      "stars": 1,
      "explanation": "Refused to collaborate.",
      "submitted_at": "2026-11-07T14:15:00Z",
      "is_invalidated": false
    }
  ]
}
```

---

### 3. Review Case (Confirm or Dismiss)
```http
PATCH /api/v1/staff/abuse-cases/{case_id}
Content-Type: application/json

{
  "status": "confirmed",
  "review_reason": "Verified coordinated retaliation by students."
}
```

---

### 4. Invalidate (Negate) an Abusive Rating
```http
POST /api/v1/staff/ratings/{rating_id}/invalidation
Content-Type: application/json

{
  "case_id": "e4b2d354-8c47-4952-b883-cf2d4c06e890",
  "reason": "Confirmed malicious invented claim."
}
```
* **Response (201 Created)**:
```json
{
  "id": "c7d8e9f0-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
  "rating": {
    "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "stars": 1,
    "is_invalidated": true
  },
  "case_id": "e4b2d354-8c47-4952-b883-cf2d4c06e890",
  "invalidated_by_username": "staff_admin",
  "reason": "Confirmed malicious invented claim.",
  "created_at": "2026-11-07T15:00:00Z"
}
```

---

### 5. Staff Dynamic Threshold Calibration (Decision D15)
```http
GET /api/v1/staff/abuse-settings
PATCH /api/v1/staff/abuse-settings
Content-Type: application/json

{
  "bulk_votes_window_minutes": 25,
  "bulk_votes_concentration": 0.40,
  "mob_attack_min_students": 4,
  "boosting_min_group_size": 3,
  "extreme_voter_min_sample": 4,
  "extreme_voter_min_positive_sample": 10
}
```

---

## 4. Frontend Developer UI Implementation Notes

### A. Unified Staff Abuse Queue
* Render all open cases from `GET /api/v1/staff/abuse-cases?status=open`.
* Group cases with tags: `[Bulk Votes]`, `[Mob Attack]`, `[Cartel Ring]`, `[Extreme Voter]`, `[1-Star Report]`.
* Each case row shows the **plain-language summary**, the students involved, and date detected.

### B. Rule #4 Pair Revenge (Neutral Advisory Presentation)
* When rendering a case where `mechanism: "pair_voting_revenge"`:
  * Check `evidence.advisory_only == true`.
  * **Do not use red "Abuse" badges.**
  * Render a subtle blue/slate badge: `"Advisory Note / Peer Dispute"`.
  * Present both students' reviews side-by-side so staff can read the mutual context neutrally without bias.

### C. Rule #8 Malicious Serious Vote (Staff Toggle & Negate Action)
* **Toggle Button**: Add a tab or toggle button: **"Show 1-Star Serious Reports"** (filters by `mechanism: "malicious_serious_vote"`).
* **Card Information**: Display:
  - Who submitted the rating, and who was accused.
  - The serious labels selected (*Aggressive behavior*, *Disrespectful*, *Bad Evaluator*).
  - The written explanation (if empty, display `"[Labels only - no written text]"`).
* **Action Button**: A red **"Negate / Invalidate Vote"** button that prompts staff for a brief note and calls:
  `POST /api/v1/staff/ratings/{rating_id}/invalidation`.

### D. Settings Calibration Tab
* Staff can open an "Abuse Thresholds" panel that calls `GET /api/v1/staff/abuse-settings`.
* Sliders/inputs allow staff to tweak sensitivity (e.g. Mob attack threshold from 3 to 4, Bulk concentration from 35% to 40%). Clicking Save calls `PATCH /api/v1/staff/abuse-settings`.

---

## 5. Verification Command
To verify the entire anti-abuse test suite at any time:
```bash
python manage.py test apps.abuse_detection
```
All 17 automated unit and integration tests run in ~20 seconds and must report `OK`.
