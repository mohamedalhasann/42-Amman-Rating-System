# Anti-Abuse System — Backend & Frontend Integration Guide

The complete and up-to-date integration guide is located at:
[`backend/apps/abuse_detection/INTEGRATION_GUIDE.md`](file:///c:/Users/hadi/Documents/42-Amman-Rating-System/backend/apps/abuse_detection/INTEGRATION_GUIDE.md)

### Quick Reference
* **Core Package**: `backend/apps/abuse_detection/`
* **Test Suite**: `python backend/manage.py test apps.abuse_detection` (17 tests, 100% passing)
* **Periodic Scan**: `python backend/manage.py scan_abuse` (or `POST /api/v1/staff/abuse-cases/scan`)
* **Submission Hook**: `evaluate_vote_submission(rating)` in `services.py`
* **Star Average Exclusion**: Remember to filter `is_invalidated=False` when calculating student star averages!
* **Staff Endpoints**:
  - `GET /api/v1/staff/abuse-cases?status=open`
  - `GET /api/v1/staff/abuse-cases/{id}`
  - `PATCH /api/v1/staff/abuse-cases/{id}`
  - `POST /api/v1/staff/ratings/{id}/invalidation`
  - `GET /api/v1/staff/abuse-settings`
  - `PATCH /api/v1/staff/abuse-settings`
