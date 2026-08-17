# Google Classroom: three options, and what each costs

Written to be decided from. Every option below is buildable except where
stated. The constraint that shapes all of them is at the top, because it is
not negotiable and it eliminates most of the obvious answers.

## The constraint

A student under 13 cannot hold a personal Google account. Consumer accounts
have an age floor (13 in the US, 14 to 16 in parts of the EU). The only way a
child of that age uses Classroom is on a **managed account issued by an
organisation** on its own domain, where the organisation carries the consent
responsibility instead of the child.

Yakal serves middle school through college. So any option that puts students
inside Classroom requires Yakal to become a Google Workspace customer and
provision an account per student. Education editions generally require
accredited-institution status, which Yakal does not have, so that means paid
business seats.

The second constraint follows from the first. Classroom's
`studentSubmissions` are keyed to a Google user who is a **member of the
course**. There is no "submit on behalf of" API. So a student with no Google
account can never have a Classroom submission, and no amount of cleverness in
our code changes that.

Everything below is a consequence of those two facts.

---

## Option A: Classroom authors, Yakal tracks

Tutors work in Classroom. Students never touch it.

- The operations account creates the class and adds the tutor as a co-teacher.
- Tutors author topics, assignments and materials in Classroom.
- Yakal reads them through the operations account and shows them to students
  and parents.
- A student marks an assignment done **in Yakal**. That is one boolean on the
  `submissions` table that already exists.

**Pros**

- No Google account for any student. No Workspace purchase, no provisioning,
  no password resets, no age problem.
- Tutors keep the authoring tools they know, and Drive behind them. This is
  the part we would otherwise have to rebuild.
- Parents and tutors get real progress: "7 of 12 done" on the dashboard.
- Adding a tutor is one API call at approval time, not a manual invitation.
- Already 70% built. The read-through and topics work today.

**Cons**

- Progress is self-reported. A student ticking a box is not the same as work
  turned in, and nothing stops them ticking it without doing it.
- Two places hold truth about one assignment: Classroom knows the definition,
  Yakal knows completion. They are bridged by `assignments.external_id`, and
  that bridge is a thing that can break.
- Tutors see completion in Yakal and their own Classroom in parallel, which
  is two screens for one question.
- Needs the `classroom.rosters` scope for the co-teacher call, so the refresh
  token must be re-minted.

**Build cost:** a migration for `external_id`, a mark-done control, a rollup,
and the co-teacher call. Two to three days.

---

## Option B: Classroom authors, Yakal mirrors, nothing tracks

The same as A, minus the checkbox.

- Yakal shows topics and assignments read from Classroom, with an "Open in
  Classroom" link on anything that has a page.
- No completion state anywhere.

**Pros**

- The least code of any option, and almost all of it already exists. Days
  become hours.
- Nothing can disagree with anything, because only Classroom holds truth.
- No schema change, no new scope, no bridge to break.

**Cons**

- A parent cannot see whether their child is doing the work, which is one of
  the main reasons a parent opens the dashboard.
- The tutor's student view has nothing to show.
- The "Open in Classroom" link is a dead end for anyone without a Google
  account, which is most students under 13.
- It makes Yakal a booking system that also displays a reading list.

**Build cost:** under a day.

---

## Option C: everyone in Classroom

Yakal buys Google Workspace, issues an account per student, enrols them on
purchase, and deep-links into Classroom for everything.

**Pros**

- One source of truth. Real submissions, real grades, real Classroom state,
  and Yakal can read all of it through the operations account.
- Nothing to build for turn-in or grading. Google has already built it.
- Tutors and students use one familiar product rather than two.

**Cons**

- A per-seat bill that grows with every student.
- An account provisioning and support burden that Yakal has no team for:
  creating accounts, resetting passwords, deprovisioning on churn.
- Onboarding friction at the worst possible moment, immediately after a parent
  has paid.
- Yakal's own dashboards become a shell around a link.
- Education editions likely unavailable without accredited status.

**Build cost:** small in code, large in operations. The code is the easy part
and the reason not to do it is everything else.

---

## Option D: drop Classroom

Yakal authors assignments in the admin, students turn in and are graded in
Yakal. The integration is deleted.

**Pros**

- One system. No Google dependency, no weekly-expiring refresh token, no 403s,
  no scope re-minting.
- Everything works for every student regardless of age.
- Full control over the experience.

**Cons**

- We rebuild authoring, materials, turn-in and grading, which is a real
  product, not a feature.
- Tutors lose tools they know for tools we write.
- Maintenance forever, which is exactly what was ruled out.

**Build cost:** weeks, and ongoing.

---

## Recommendation

**Option A.** It is the only one that gives a parent a real answer to "is my
child doing the work" without buying Workspace, and it keeps authoring where
tutors already are.

Its honest weakness is that completion is self-reported. If that is not good
enough, the next step up is Option C and its true cost is operational, not
technical. Option B is the right choice only if progress visibility turns out
not to matter, and that is worth testing with a few parents before assuming.

Option D is here for completeness. It was ruled out on maintenance grounds and
nothing since has changed that.
