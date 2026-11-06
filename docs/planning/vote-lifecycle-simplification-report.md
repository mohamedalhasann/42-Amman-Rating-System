# Architectural Alignment Report: Simplification of Vote Lifecycle

**Date:** 6 November 2026  
**Workstream:** Anti-Abuse System & Core Backend Architecture  
**Status:** Adopted across planning specifications  
**Primary Reference:** `42_Amman_Rating_System_Next_Phase.pdf` (Phase 2 + 3 Specification)

---

## 1. Executive Summary

During the architectural review of the planning documentation against the official hackathon specification, a discrepancy was identified in the vote processing pipeline. Earlier design drafts had introduced a multi-tier review workflow for 1-star ratings, holding them in a pending (`held`) state until individual staff approval or rejection.

In accordance with team review and the official hackathon specification, this intermediate approval queue has been removed. Every accepted student submission (1, 2, or 3 stars) now immediately counts toward the recipient’s star average upon submission (`counted` state). Staff retain full authority to negate abusive ratings via **vote invalidation** (`invalidated` state) upon reviewing evidence in the unified Abuse Review dashboard.

This report documents the architectural rationale, the changes applied across the planning documentation, and the concrete benefits to implementation stability and hackathon evaluation.

---

## 2. Rationale and Hackathon Specification Alignment

### 2.1 What the Hackathon Specification Mandates
The hackathon brief (`42_Amman_Rating_System_Next_Phase.pdf`, pages 1–2) and the supporting experience documents outline specific requirements:
* **Rating & Labels:** Students rate peers from 1 to 3 stars, with star levels controlling available labels.
* **Staff Controls:** Staff configure windows, manage labels, view analytics, and export CSVs.
* **Abuse Detection & Review:** The system detects 8 specific abuse scenarios, presents them in plain language in a unified staff review view, and allows staff to **invalidate (negate)** a vote once confirmed as abuse.
* **Rubric Focus (Depth & Stability over Feature Bloat):** The hackathon guidelines explicitly state: *"depth, clarity and polish matter more than feature count"* and allocate 20% to *Technical excellence* and 20% to *Maturity & stability*.

### 2.2 Why the "Held / Pre-Approval" Queue Was Removed
The previous proposal added:
1. A 4-state lifecycle (`counted`, `held`, `rejected`, `invalidated`).
2. An additional entity (`RatingReview`) and dedicated endpoints (`/staff/rating-reviews`, `POST /staff/ratings/{id}/review`).
3. Fragmented staff workflows split between two separate queues: one for approving 1-star votes and another for reviewing abuse cases.
4. Asymmetric rating calculation logic where 1-star votes lagged behind 2- and 3-star votes.

**Resulting Decision:** Revert to the clean, spec-compliant model:
* All accepted submissions count immediately.
* 1-star votes still require an official flag and a mandatory explanation. These inputs provide critical evidence for abuse detection and staff audits, but do not block the vote from counting.
* Malicious or retaliatory 1-star votes are handled through the standard **Anti-Abuse System** (under the "Malicious serious vote" and "Pair voting / revenge" detectors) and invalidated when confirmed.

---

## 3. Comparative Analysis (Before vs. After)

| Dimension | Previous Draft | Updated & Implemented Policy |
| :--- | :--- | :--- |
| **Vote States** | 4 states: `held`, `counted`, `rejected`, `invalidated` | 2 states: `counted` (valid) and `invalidated` |
| **1-Star Vote Initial State** | `held` (excluded from average until staff review) | `counted` (counts immediately) |
| **1-Star Pre-Conditions** | Flag + explanation required; awaits approval | Flag + explanation required; stored as audit evidence |
| **Average Calculation** | Complex conditional: excludes `held`, `rejected`, and `invalidated` | Simple query: `Rating.objects.filter(is_invalidated=False)` |
| **Entities & Relations** | Required `RatingReview` table linked 1-to-1 with `Rating` | `RatingReview` removed; existing `Invalidation` entity covers staff negation |
| **Staff Workflows** | 2 disparate review queues (Content Review & Abuse Review) | 1 unified review center (Abuse Review & Invalidation) |
| **API Endpoints** | Redundant `/staff/rating-reviews` & review actions | Streamlined; dedicated `/staff/abuse-cases` and invalidation route |

---

## 4. Workstream Impact Assessment

### 4.1 Anti-Abuse System Workstream
* **Uniform Ingestion:** Detectors inspect a uniform stream of submitted ratings across 1, 2, and 3 stars without branching on pending approval flags.
* **Deterministic Evidence:** Detectors can directly flag suspicious 1-star submissions (e.g., sudden rating drops, revenge pairs, or boilerplate/invented explanations) as `AbuseCase` records.
* **Actionable Invalidation:** Staff confirm abuse and trigger `/staff/ratings/{id}/invalidation`, immediately updating recipient scores in real time.

### 4.2 Backend & Database Workstream
* **Simplified Schema:** Removed `RatingReview` table, foreign keys, and redundant indexes.
* **High Performance Queries:** Student average queries require only a simple filter on the non-invalidated condition (or `state = 'counted'`), avoiding multi-table joins.
* **Atomic Transactions:** Vote submission commits atomically in a single pass without queueing asynchronous hold-state notifications.

### 4.3 Student & Staff Frontend Workstreams
* **Instant Feedback:** Students see their updated vote quota and own average immediately after submitting.
* **Cleaner Staff PC Dashboard:** Staff metrics focus on genuine system health (`ratings_submitted`, `ratings_counted`, `ratings_invalidated`) rather than managing approval backlogs.

---

## 5. Summary of Modified Specification Files

The following files in `docs/planning/` were updated to reflect this architectural decision:

1. **[`requirements.md`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/docs/planning/requirements.md)**
   * Line 39: Clarified that all accepted votes count immediately, removing references to held submissions.
2. **[`decisions.md`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/docs/planning/decisions.md)**
   * Decision table updated: Confirmed votes are not held before counting; pair uniqueness and allowance consumption apply across all accepted and invalidated votes.
3. **[`voting-rules.md`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/docs/planning/voting-rules.md)**
   * Section 1: Initial treatment of 1-star votes changed to "Counts immediately".
   * Section 4: Average calculation defined as arithmetic mean of all non-invalidated votes.
   * Section 5: Merged review section into unified Abuse Review and Invalidation.
4. **[`data-models.md`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/docs/planning/data-models.md)**
   * Removed `RATING_REVIEW` from the Mermaid ER diagram and text.
   * Simplified derived state hierarchy to `counted` and `invalidated`.
   * Updated `Votes used`, derived values, and database index recommendations.
5. **[`api-contract.md`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/docs/planning/api-contract.md)**
   * Rating submission returns `state: "counted"` for all star levels.
   * Removed `GET /staff/rating-reviews` and `POST /staff/ratings/{id}/review`.
   * Updated overview metrics and CSV export columns.
6. **[`abuse-review.md`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/docs/planning/abuse-review.md)**
   * Confirmed baseline detection operates across all accepted votes without dependency on separate approval queues.
7. **[`implementation-plan.md`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/docs/planning/implementation-plan.md)**
   * Stage 2 completion checks updated to focus on immediate rating calculation and 1-star explanation capture.

---

## 6. Next Steps for Implementation

1. **Finalize Thresholds (Decision D15):** Finalize numeric cutoffs for bulk volume, time windows, and sample sizes for the 8 abuse detectors.
2. **Scaffold Django Abuse Detection App:** Set up `apps/abuse_detection/` containing `models.py` (`AbuseCase`, `AbuseCaseFinding`, `Invalidation`, `VoteAttempt`) and detector logic.
3. **Synthetic Test Fixtures:** Generate test cases for all 8 abuse patterns to ensure comprehensive coverage during demo and staff evaluation.
