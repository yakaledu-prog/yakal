# The counsellor's own screens

Walked as Daniel Haile, the seeded counsellor with one student.

## The home page is fabricated, and cannot show anything else

`src/pages/counselor/CounselorHome.tsx`, under a comment reading
`// --- MOCK DATA INJECTION ---`:

```ts
const activeUpcomingSessions = mockSessions.length > 0 ? mockSessions : upcomingSessions;
```

`mockSessions` is a hardcoded array of two. Its length is always 2, so the
condition is always true and **the real `upcomingSessions` can never render**.
The same pattern sits above it:

```ts
const mockDashboard = dashboard ? { ...dashboard, totalStudents: 1, essaysInReview: 0, upcomingDeadlines: [ ...three fabricated colleges... ] } : null;
const activeDashboard = mockDashboard || dashboard;
```

So whenever the real dashboard loads it is overwritten. Observed live:

| The counsellor sees | The database says |
| --- | --- |
| "You have 2 upcoming sessions" | 0 sessions for this counsellor |
| UPCOMING SESSIONS 2 | 0 |
| TOTAL STUDENTS 1 | hardcoded, whatever the truth |
| ESSAYS IN REVIEW 0 | 1 waiting, per their own Essays page |

The two fabricated sessions are attributed to a real student, Amen Worku, at
real times, with a **Join Session** button pointing at
`https://zoom.us/j/123456789`. A counsellor would click it and land nowhere.

The contradiction is visible without a database: the home page says two upcoming
sessions, and `/counselor/sessions` says "0 sessions total" on the same login.
`ESSAYS IN REVIEW 0` against "1 waiting on you" is the dangerous one, because
that is how a counsellor decides there is nothing to do today.

This is the single worst thing found in the audit. It is not subtle, it is
labelled as temporary, and it ships to every counsellor.

**Fix:** delete both mock blocks and the unsplash images with them. The real
queries are already there and already correct.

## The advising wall

Every counsellor in the database has published zero availability, and nine of
ten tutors have none either.

```
Daniel Haile         counselor   0 slots
Binyam (counsellor)  counselor   0 slots
Bethlehem Alemu      tutor       1 slot
(eight more tutors)  tutor       0 slots
```

A counsellor can publish hours: `/counselor/calendar` has a **Set Availability**
button. Nothing asks them to. So the default state of a new counsellor is one in
which the family's flagship deliverable cannot be booked, and neither party is
told.

What the family sees is a dead end. The booking dialog opens and says:

> This tutor has not published any hours yet.

with no way to request a time, no way to message the counsellor from there, and
nothing that says "we will tell you when hours open".

Two fixes, both small:

- Prompt a counsellor with no published hours, on their own home page, once they
  have a student. The empty state should be theirs, not the family's.
- Give the family something to do at the wall: message the counsellor, or ask
  for a time. The messaging feature already exists.

## Vocabulary

A counsellor is called "This tutor" in the booking dialog
(`AvailabilityPicker.tsx:149`, `ContactInfoPanel.tsx:128`). Small, but it is the
one screen where a family is deciding whether this expensive thing is real.

## What is good

Worth saying, because most of this document is not.

- **`/counselor/essays` is a genuinely useful queue.** "1 waiting on you across
  1 student", split into waiting on me, with the student, and finished. A
  counsellor opening this knows what to do.
- **`/counselor/students`** is a real workspace: requirements, essays,
  documents, recommendations and the college list per student, with per-college
  progress. This is the strongest screen in the counselling product.
- **`/counselor/earnings`** is honest and says plainly that payment is by hand
  until Stripe onboarding is done.

## One display bug

The home page lists Harvard under **Upcoming Deadlines** with the label
**PASSED** and a date two days ago. A passed deadline is not upcoming. It comes
from the mock block, so deleting that fixes it, but the real deadline list should
be checked for the same thing.
