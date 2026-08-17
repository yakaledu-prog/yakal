# Testing the Classroom integration

Do these in order. Stages 1 to 4 are in Google Classroom, stage 5 onward is in
Yakal.

Assumes `docs/GOOGLE_SETUP.md` is done and `GOOGLE_OAUTH_REFRESH_TOKEN` is set.

## The fixture

Everything is already wired to one course, so there is nothing to configure.

| | |
| --- | --- |
| Yakal course | **K-12 Mathematics** |
| Google class | **yakal**, `https://classroom.google.com/c/ODcwNjI3MzQ5NDc2` |
| Operations account | **binyam2537@gmail.com**, owns the class, holds the token |
| Tutor | **binyam2537+tutor@gmail.com**, no Google account needed |
| Student | **binyammamo01@gmail.com**, must be a real Google account |
| Parent | **binyam2537+parent@gmail.com**, linked to the student |

Every Yakal password is `demo123`.

If you seeded before today, run `npm run db:seed` once to pick this up.

---

## Stage 1: add topics to the class

Signed into Classroom as **binyam2537@gmail.com**, open the **yakal** class. It
has 4 published assignments and no topics, so grouping has nothing to show yet.

1. **Classwork** tab > **Create** > **Topic**. Name it `Algebra`. Create.
2. Create a second topic, `Geometry`.
3. For each of three assignments: click the three dots > **Edit** > set
   **Topic** on the right. Put two under Algebra, one under Geometry.
4. **Leave the fourth assignment with no topic.** That is what proves the
   "Other work" bucket appears, and appears last.

## Stage 2: put the student in the class

1. **People** tab > **Invite students** (the person-with-plus icon).
2. Enter `binyammamo01@gmail.com` and invite.
3. Open that invite from the **binyammamo01@gmail.com** inbox and **accept**
   it. Use a separate browser profile or a private window, or Google will keep
   you signed in as the operations account.

Nothing about submissions works until the invite is accepted. Before that the
student is not a member, so Classroom has no submissions to report and Yakal
shows the work with no state on it.

## Stage 3: turn one assignment in

Still signed in as **binyammamo01@gmail.com**, in the yakal class:

1. Open any assignment that has a topic.
2. **Add or create** > attach anything, or use **Mark as done** if there is no
   attachment required.
3. **Turn in**.

Leave the other three untouched. The contrast is the point.

## Stage 4: grade it

Back as **binyam2537@gmail.com**:

1. **Classwork** > the assignment you turned in > **View assignment**.
2. Enter a grade next to the student.

**Stop here first and check stage 6.** A grade that has been typed but not
returned is a draft grade, and the student must not see it. That is a real
rule, pinned by a test, and this is the one chance to confirm it against live
data.

Then come back, tick the student, and click **Return**. The grade is now theirs
to see.

---

## Stage 5: start Yakal

```
npm run dev
```

App on 5173, API on 3001. Both are needed: the Classroom read goes through our
own server, not the browser.

## Stage 6: check each role

Sign in at http://localhost:5173 with password `demo123`.

### Student

`binyammamo01@gmail.com`, then **My Learning** > **K-12 Mathematics**.

Direct link:
http://localhost:5173/student/my-learning/91237c65-93e4-407b-9c90-421ffa544081

Expect:

- Assignments under **Algebra** and **Geometry** headings
- **Other work** last, holding the one with no topic
- The turned-in assignment carrying a teal border and tinted header
- Its grade shown, but **only after stage 4's Return**. Before returning, the
  assignment should look turned in with no grade.

### Tutor

`binyam2537+tutor@gmail.com`, then **Courses** > **K-12 Mathematics**.

Expect the same grouped list, plus a row on each assignment reading
**1 turned in** with the student's avatar, and **Nobody has turned this in
yet** on the other three. No personal grade anywhere: a tutor has no submission
of their own.

### Admin

`binyam2537@gmail.com`, then **Courses** > **K-12 Mathematics**.

Expect the same as the tutor.

### Refusal

`student2@yakal.com` at the student link above. Expect **Not your course**, not
an empty list. An empty list would claim the teacher set nothing, which is a
very different and much more comforting lie.

---

## Reading a failure

| What you see | What it means |
| --- | --- |
| Flat list, no topic headings | Token has no `classroom.topics.readonly`. Re-mint, stage 5 of the setup guide. |
| "That class was not found for the Yakal Google account" | The course points at a class this token cannot see. Different Google account, or a deleted class. |
| "Google access has expired" | Refresh token dead. Usually an OAuth app left in Testing, which expires them weekly. |
| Work lists, but no turned-in state | The student has not accepted the class invite, so Classroom has no submission rows for them. |
| A grade appears before you clicked Return | Draft grade leaking. This is pinned by a test, so it would be a real find. |
| Empty list where work exists | Assignment is a draft in Classroom. Only PUBLISHED work is shown, deliberately. |

## What is not built yet

- **No parent screen shows this.** The API grants a parent their child's view,
  and it is covered server side, but no parent page renders the assignment
  list. So the parent row in the fixture cannot be checked through the UI.
- **Due dates are Classroom's own.** Per-student dates derived from the
  enrolment date are not built, because nothing on `courses` carries a
  duration, session count or start date to derive a cadence from.
- **Nothing writes to Classroom.** No turn-in, no grading, no enrolment from
  Yakal. Adding co-teachers and inviting students is the next step and needs a
  wider scope than the current token has.
