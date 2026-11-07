# Planning before implementation

Status: Planning draft incorporating owner decisions. Stack: Django, React, PostgreSQL. Profile import, local accounts and the [staff React workspace](../../staff-frontend/README.md) are implemented in [backend](../../backend/README.md). Shared React login and student frontend integration, student submission, automated detection and deployment remain pending. The API contract distinguishes implemented staff endpoints from proposed granular routes.

The source of truth is [the hackathon specification](../42_Amman_Rating_System_Next_Phase.pdf). The [student experience](../42_Amman_Student_Experience_PC_and_Mobile.pdf) and [staff experience](../42_Amman_Staff_Experience_PC.pdf) describe the interface workstreams. These plans use only those three current PDFs as sources.

## Read in this order

1. [Requirements](requirements.md): What the hackathon explicitly asks for and how to verify it.
2. [Decisions](decisions.md): Open questions, proposed defaults, and what they affect.
3. [Data models](data-models.md): Entities, relationships, constraints, and derived values.
4. [Voting rules](voting-rules.md): Submission, averages, participation, windows, and invalidation.
5. [API contract](api-contract.md): Proposed endpoints and shared response shapes.
6. [Security and access](security-and-access.md): Roles, privacy boundaries, and access checks.
7. [Abuse review](abuse-review.md): Detection coverage, evidence, and human review.
8. [Implementation plan](implementation-plan.md): Order of work and completion checks.
9. [Authentication](authentication.md): Imported roster, email password setup, and approval.
10. [Vote lifecycle alignment report](vote-lifecycle-simplification-report.md): Architectural report on aligning vote lifecycle with the hackathon specification.

## How to read these plans

- **Required** means explicitly stated in the main PDF.
- **Proposed** means a team design choice. It is not an additional hackathon requirement.
- **Open** means the team has not decided. An example value does not approve a policy.

Technical structures and endpoint names remain proposals. Agreed owner policies are recorded in decisions.md, separately from official requirements. Do not use older deleted files as requirements.

## Immediate team handoff

Use the implemented account and staff contracts for integration. The shared login on `feat/student-frontend` should resolve the stored role through username/password authentication and send staff to `/staff/`; no role selector is needed. Connect the student frontend only when the owner requests it. Remaining submission and detection work must preserve roster, privacy and voting rules.
