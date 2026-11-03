# Implementation plan after documentation review

Status: Proposed order. No backend or database implementation is part of this documentation task. Owners remain unassigned until the team agrees.

## 1. Agree on the foundation

- Review blocking decisions in [decisions](decisions.md), record answers, and update dependent documents.
- Choose the stack and identity integration based on available access and team familiarity.
- Agree the roster source, window rules, label mapping, and privacy-safe recipient directory with staff.
- Review the models and API shapes together, then prepare shared mock responses for student and staff interfaces.

Completion: no unresolved policy blocks account creation, a rating submission, or its average calculation.

## 2. Build one complete rating flow

- Set up the approved schema, authentication, student roster, staff role, one voting window, and permitted labels.
- Implement dashboard, peer selection, labels, and atomic rating submission.
- Implement staff inspection of the stored rating.
- Protect student privacy and staff routes from the first working version.

Completion: a student can submit a valid rating, see the updated allowance, and receive their own average only. Staff can inspect the submission. Invalid stars, invalid labels, closed windows, excessive votes, retries, and concurrent submissions behave according to agreed rules.

## 3. Complete staff management and analytics

- Add overview, participation including non-voters, both vote directions per student, and grouping.
- Add label controls, live window edits, configurable limits, and staff-only CSV export.
- Preserve historical votes and labels across configuration changes.

Completion: totals reconcile, edits affect subsequent requests, and student calls to staff controls and export fail.

## 4. Add detection and review

- Implement the agreed rules for all eight example cases and retain reliable detection work.
- Build the unified review queue with readable evidence and involved students.
- Add confirmation, dismissal, vote invalidation, and audit records.

Completion: synthetic scenarios trigger understandable findings; invalidation updates averages without deleting history or changing unrelated votes.

## 5. Validate and prepare delivery

- Verify end-to-end student flows on PC and mobile and staff flows on PC.
- Run focused access-control, transaction, boundary-time, configuration-edit, and abuse-review checks.
- Ask staff for feedback early enough to incorporate it.
- Deploy the agreed demo, use synthetic accounts, rehearse the 5 to 8 minute presentation, and verify all links.
- Confirm the deadline timezone with staff and finish GitHub commits before the stated cutoff.

## Workstream handoff

| Workstream | Needs | Produces | Owner |
| --- | --- | --- | --- |
| Student interface | Approved student API responses, label rules, privacy boundaries | PC and mobile rating and dashboard flows | Team to assign |
| Staff interface | Staff API responses, metric definitions, case model | PC analytics, configuration, export, and review flows | Team to assign |
| Backend and database | Agreed decisions, models, identity source | Persistence, transactions, role checks, APIs, calculations | Team to assign |
| Abuse detection | Accepted votes, attempt records, agreed rules | Durable findings and staff-readable cases | Team to assign |

Use [requirements](requirements.md) as the final coverage checklist. Documentation agreement is a dependency, not permission to expand the product beyond the hackathon specification.
