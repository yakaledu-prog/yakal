# Diagnostics: deferred

Parked on 2026-08-01. Nothing here is built. The scope was widening faster
than the value was arriving, so it waits until the course flow is finished.

## What exists today

- `src/services/diagnosticService.ts` writes results to `localStorage` under
  `yakal_diagnostic_results`. There is no table.
- `StudentDiagnostics` lists tests grouped by subject.
- The diagnostic is offered immediately after student onboarding.

## The problem with the current shape

Results in `localStorage` die with the browser. A tutor or counselor can never
see them, they do not survive a device change, and nothing on the server can
use them to recommend a course. Whatever the feature becomes, it needs a
`diagnostic_results` table first. That is the blocking prerequisite.

## The question that was being asked

Whether a diagnostic belongs to a subject or to a course, whether it lives on
its own page or in a tab, and whether offering it straight after onboarding is
right when the student may never take that subject.

## The distinction to keep in mind when this restarts

A diagnostic does two different jobs, and conflating them is what made the
question hard:

1. **Placement, before enrolment.** "What does this student need?" It has to
   work for somebody with no courses at all, because it is what tells a parent
   which course to buy.
2. **Baseline, inside a course.** "Where did they start, so progress means
   something?" Only makes sense after enrolment.

Separating those answers most of it: author diagnostics per subject so the
content does not explode across near-identical courses, let a course reference
one as its baseline, keep the standalone page for job one, and add a course tab
for job two. Offering one short diagnostic after onboarding is good; offering a
battery of them is what feels wrong.

## Not decided

- Whether progress tracking against a baseline is worth the complexity at all.
  It was raised and judged too complicated for now.
- Whether `College Advising` should stay in `courses_subject_check`. It is a
  service parents opt into rather than a subject anyone teaches.
