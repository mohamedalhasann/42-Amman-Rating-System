# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Students of 42 Amman** (primary). They rate the peers they worked with, using 1 to 3 stars plus labels, during a voting window. Later they check their own rating. They use it on PC and on mobile, often in a quick moment between projects. They already live inside peer evaluation every day, because 42 has no teachers and students grade each other's projects.
- **42 Amman staff** (secondary, separate PC interface). They configure windows, limits and labels, review abuse cases, invalidate abusive votes and export ratings.

## Product Purpose

Fairly gives 42 Amman a fair, anonymous way for students to rate how peers behave as teammates and community members, and gives staff a readable view of it.

Success means two things:
1. The project wins the 42 Amman hackathon, where staff judge it.
2. 42 Amman then adopts it for real use with students.

## Positioning

Fairness is built into the mechanism, not just claimed in copy:
- Students only ever see their own average. They never see received labels, other students' ratings, or who rated them.
- When too few people rate someone in a window, that student's rating carries over unchanged. No change can then be traced back to a single vote.
- Serious (1-star) votes need a flag and an explanation, so staff have context if a vote is investigated for abuse.

## Operating Context

- **Voting windows.** Staff set and change the windows. One window is open at a time, with a server-clock deadline. Staff configure the minimum and maximum votes per student per window. The minimum is a participation target, not a block.
- **Vote outcomes.** Every accepted vote counts immediately. Staff can invalidate votes linked to confirmed abuse, which updates averages but never restores the voter's allowance. A submitted vote cannot be edited.
- **Accounts and roster.** The roster comes from 42 intra: usernames, first and last names, pictures. Students sign in with a username and password after email setup at `{login}@student.42amman.com`. Staff can require manual approval of new students.

## Capabilities and Constraints

- **Rating carries real consequences** for students. The outcome can affect something formal at 42 Amman. Seeing your own rating is therefore a high-stakes moment.
- **Terminology:**
  - a **vote** is the act of rating one peer;
  - the **rating** is the student's own average (1–3);
  - **labels** describe the vote;
  - **flags** are 1-star labels.
- **Stack:** React 18 + TypeScript + Vite (`frontend/`), with a Django API at `/api/v1` and a mock API in `frontend/src/api/mock.ts`.
- **Source of truth:** `docs/planning/` and the three PDFs in `docs/`.
- **Open product facts:**
  - the exact formal consequences of a rating;
  - the deadline timezone;
  - label length limits;
  - the abuse-detection thresholds.

## Brand Commitments

None binding. The owner confirmed that the name "Fairly", 42 cyan, the student-chosen accent colour and the character avatars may all change in a redesign.

## Evidence on Hand

- **Hackathon specification and experience PDFs:** `docs/42_Amman_Rating_System_Next_Phase.pdf`, `docs/42_Amman_Student_Experience_PC_and_Mobile.pdf`, `docs/42_Amman_Staff_Experience_PC.pdf`.
- **Initial label catalog:** `docs/planning/voting-rules.md`.
- **What does not exist:** no real usage data, testimonials or adoption figures. Do not invent any.

## Product Principles

1. **Fairness has to be visible, not just promised.** The anonymity threshold and staff review are the product, so they should be understood at a glance.
2. **Treat a person's rating with care.** Ratings carry real consequences, so show scores with context and a path forward, never as a bare verdict.
3. **A vote is a serious, final act.** Make it deliberate and clear before submitting, and reassuring after.
4. **Students see only themselves.** Never reveal or hint at anyone else's ratings, labels or identity as a rater.
5. **It should feel like it belongs to 42.** It builds on the peer-evaluation culture students already know.

## Accessibility & Inclusion

- **Devices:** core student flows must work on PC and mobile.
- **Standard:** no specific requirement has been set. Use WCAG 2.1 AA as the working baseline.
