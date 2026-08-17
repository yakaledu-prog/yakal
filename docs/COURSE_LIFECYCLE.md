# A course, from creation to a marked assignment

What happens at each stage, who does it, and where it happens. Marked
**works today** or **to build**, so the manual steps are visible rather than
discovered.

The principle: Classroom is where work is written and marked, because that is
what it is good at and rebuilding it is a year of maintenance we do not want.
Everything else should happen in Yakal, and where Google will not let us
automate something, Yakal should at least put the button in front of the person
instead of describing where to go.

---

## Stage 1: the admin creates the course

**In Yakal.** Admin > Courses > New course. Title, subject, price, tutor.

**Attaching a Google class**, in the same modal:

- *Works today:* paste an existing class URL into **Google Classroom URL**.
  **Fetch Details** previews the coursework so you can confirm you attached the
  right class.
- *To build:* adding the course's tutor as a **co-teacher** when the course is
  saved, so they can write coursework without an admin doing it for them.

**Creating the class from Yakal was considered and dropped.** `courses.create`
would work, but it only saves making an empty class by hand, and whoever made
it still has to go to Classroom to write every assignment. A button that saves
one click in a tool you then spend an hour in is not worth the code.

*Fixed:* **Fetch Details** used to sign the admin into Google through a browser
popup, which is where `Error 400: origin_mismatch` came from. It predated the
server-side read and was redundant, since the server can already read that
class. It now reads through the server, so nothing in the browser talks to
Google at all.

## Stage 2: somebody writes the coursework

**In Classroom**, as the tutor or admin. Assignments, materials, topics.

This stays manual on purpose. It is the one thing Classroom is better at than
anything we would build, and it is why we chose it. Topics become the section
headings in Yakal, so filing work under a topic is worth doing.

## Stage 3: a parent buys the course for their child

**In Yakal.** Checkout, as now.

- *Works today:* the enrolment is written and the student has **read access
  immediately**. The assignments, materials, due dates and topics all appear on
  their course page. No Google account, no invite, no waiting.
- *To build:* at the same moment, the server sends the child their **Classroom
  invitation** (`courses.invitations.create`). Nobody has to remember to.

Read access does not depend on Classroom membership, because the server reads
the class as the operations account. A student who never joins the Google class
still sees everything that was set. Joining buys two things and only two: their
own turned-in state and grade showing in Yakal, and the ability to turn work in.

## Stage 4: the student joins the class

**In Yakal, then one click in Classroom.**

- *To build:* the student's course page shows **Join the Google Classroom**
  when they have been invited but have not joined. It opens the class, where
  Google shows a Join button.

We cannot accept it for them. `invitations.accept` has to be called as the
invited user, and we deliberately hold no student credentials. This is the one
step in the whole lifecycle that Google will not let us remove, short of
Workspace for Education, where an admin can add students to a class directly.

The button still matters. Instead of "find the email Google sent you, hopefully
not in spam", it is one button on the page they are already on.

The page knows which of three states to show by asking Classroom: not invited,
invited, or joined.

## Stage 5: the work happens

- Student reads the assignment **in Yakal**, grouped under its topic.
- Student turns it in **in Classroom**.
- Tutor marks it **in Classroom**.
- *Works today:* Yakal shows the student their turned-in state and their
  returned grade, and shows the tutor who has turned in. A grade that has been
  typed but not returned stays hidden, because that is the tutor's working note
  rather than a result.

## Stage 6: the admin can see and fix

**In Yakal.** Admin > Courses > a course > **Students** tab.

- *To build:* each student's Classroom state, one of **Not invited**,
  **Invited**, **Joined**, with a **Send invite** or **Resend invite** button.

This is the safety net rather than the main path. Stage 3 sends the invite
automatically; this is for the one that bounced, the child who deleted the
email, or the family who changed address.

---

## Manual work, before and after

| | Now | After |
| --- | --- | --- |
| Create the Google class | by hand in Classroom | by hand, deliberately |
| Add the tutor as co-teacher | by hand in Classroom | automatic on save |
| Write the coursework | in Classroom | in Classroom, unchanged |
| Give the student read access | automatic | automatic |
| Invite the student | by hand in Classroom | automatic on purchase |
| Student joins | find the email | button on their course page |
| Chase a student who has not joined | nothing shows it | Students tab shows who |

Two human actions survive: writing the coursework, which is the point, and the
child clicking Join once per class, which Google requires.

## What to build, in order

1. ~~Move Fetch Details to the server.~~ **Done.** It removed the browser
   popup, the token in localStorage, and the whole `origin_mismatch` class of
   problem, and deleted more code than it added.
2. **Invite on enrolment**, plus the student's **Join** button and the admin's
   **Students** tab state. This is the stage that removes the most manual work.
3. **Add the tutor as co-teacher** when a course with a class attached is
   saved.

Steps 2 and 3 need `https://www.googleapis.com/auth/classroom.rosters` instead
of the `.readonly` form we hold now, so they cost one token re-mint, done once
for both. See `docs/GOOGLE_SETUP.md`.

## Trying the read path today

The `K-12 Mathematics` course is already attached to the `yakal` class. To see
stages 3 and 5 working now, the class needs topics and at least one student, so
in Classroom as **binyam2537@gmail.com**:

1. Create two topics and file three of the four assignments under them, leaving
   one bare so the "Other work" group shows.
2. Invite `binyammamo01@gmail.com`, and accept from that account.
3. Turn one assignment in as the student, then grade and **Return** it.

Then sign in to Yakal, password `demo123` throughout:

| Sign in as | Where | Expect |
| --- | --- | --- |
| `binyammamo01@gmail.com` | My Learning > K-12 Mathematics | work under topic headings, their turned-in one marked, their returned grade |
| `binyam2537+tutor@gmail.com` | Courses > K-12 Mathematics | the same list, plus who turned in |
| `binyam2537@gmail.com` | Courses > K-12 Mathematics | the same as the tutor |
| `student2@yakal.com` | the student link | "Not your course", not an empty list |

Reading a failure:

| What you see | Cause |
| --- | --- |
| flat list, no topic headings | token lacks `classroom.topics.readonly` |
| "not found for the Yakal Google account" | class belongs to a different Google account |
| "Google access has expired" | refresh token dead, usually an app left in Testing |
| work lists, no turned-in state | the student has not joined the class |
| a grade before you clicked Return | draft grade leaking, which would be a real find |
