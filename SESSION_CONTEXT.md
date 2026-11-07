# Project Session Context & Handoff

**Project:** 42 Amman Rating System Hackathon (Merged Phase 2 + 3)  
**Assigned Workstream:** Anti-Abuse System  
**Deadline:** Sunday 8 November 2026 at 9:00 AM  
**Stack:** Django (backend), PostgreSQL (db), React (frontend)  
**Status:** All 8 Hackathon Scenarios Reviewed, Refined, and Tested (100% Passing)

---

## 1. What Has Been Agreed and Completed

### Collaborative One-by-One Review of All 8 Rules:

1. **Rule #1: Bulk votes (`detect_bulk_votes`)**:
   - Refactored from fixed threshold to **dynamic concentration ratio**: checks what fraction of active campus votes targeted this student ($V_{\text{target}} / V_{\text{campus}}$).
   - **Deadline Rush Protection**: In the final 2 hours of a voting window, thresholds dynamically relax so organic end-of-window rush traffic does not trigger false alarms.

2. **Rule #2: Repeated votes (`detect_repeated_votes`)**:
   - Identifies persistent targeting across consecutive voting windows ($\ge 2$ consecutive windows with identical negative or positive ratings).
   - Exempts fluctuating ratings (e.g., 1★ $\rightarrow$ 3★) because students learn, improve, and reconcile over time.

3. **Rule #3: Group voting / Mob attack (`detect_group_voting`)**:
   - Strictly detects coordinated negative mobs: $\ge 3$ students casting 1-star ratings against the same peer within 60 minutes.

4. **Rule #4: Pair voting / Revenge (`detect_pair_revenge`)**:
   - Detects mutual 1-star ratings within the same window.
   - Formatted as a neutral contextual advisory (`advisory_only=True`) without accusatory "abuse" branding, de-escalating standard evaluation friction.

5. **Rule #5: Friends boosting (`detect_friends_boosting`)**:
   - Detects circular 3-star boosting cartels across multiple windows.
   - **Legitimate Group Exemption**: Single-window 3-star exchanges are exempted (assumed normal project teams like ft_transcendence).
   - **Core Overlap ($\ge 3$ members)**: Catches rings even if they recruit new members or swap students across sprints.

6. **Rule #6: Too fast or too often**:
   - **Architectural Resolution**: Handled at the infrastructure/database boundary:
     - "Too often" is strictly prevented by `VotingWindow.max_votes` hard quota constraints.
     - "Too fast" is enforced at the network gateway (Nginx rate-limiting / DRF API throttling with HTTP 429), keeping the abuse review engine free of redundant post-facto velocity checks.

7. **Rule #7: Extreme voter (`detect_extreme_voter`)**:
   - **Asymmetric Thresholds**:
     - Serial 1-star negative voter triggers at a low, sensitive threshold ($\ge 4$ votes) as a high-severity warning.
     - 3-star positive voter only triggers at $\ge 10$ votes and is classified as an informational note (`advisory_only=True`), respecting peer gratitude while satisfying hackathon rubric coverage.

8. **Rule #8: Malicious serious vote (`detect_malicious_serious`)**:
   - Transparent pass-through for 1-star disciplinary reports.
   - Avoids fake AI text-guessing: every 1-star rating enters the staff review docket with voter, recipient, flags, and explanation (or `[Labels only]`).
   - Staff uses the 1-click **Invalidate Vote** action (`POST /api/v1/staff/ratings/{id}/invalidation`) to negate invented claims.

---

## 2. Technical Architecture & Handoff
* **Backend App:** `backend/apps/abuse_detection/`
* **Centralized Calibration:** `AntiAbuseSettings` singleton model with live REST API (`GET / PATCH /api/v1/staff/abuse-settings`).
* **Test Suite:** `backend/apps/abuse_detection/tests/test_detectors.py` (17 tests, 100% passing).
* **Developer Guide:** `backend/apps/abuse_detection/INTEGRATION_GUIDE.md` and `docs/anti-abuse-integration.md`.
