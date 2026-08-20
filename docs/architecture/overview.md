# What this is

Yakal Education Services sells two things: **tutoring** and **college
admissions counselling**. The app is where both are bought, delivered and
administered.

---

## The five roles

Every account is exactly one role, stored on `profiles.role`. The role decides
which route tree the user lands in, and most row-level security policies are
written in terms of it.

| Role | What they do |
| --- | --- |
| **Student** | Attends sessions, reads assignments, builds a college list, uploads documents |
| **Parent** | Pays for everything, links to their children, books services, watches progress |
| **Tutor** | Applies to teach courses, runs sessions, sets availability, requests payouts |
| **Counselor** | Advises on admissions, reviews essays, holds advising slots |
| **Admin** | Approves tutors and counselors, creates courses, assigns people, sees everything |

**Parents pay, students consume.** That split runs through the whole data
model: a student never sees a price, and a parent never does the homework. The
link between them is `parent_student_links`, which a parent requests and a
student accepts.

## The flows that matter

**Buying a course.** A parent browses the catalog, checks out through Stripe,
and a webhook marks it paid and creates the enrolment. Nothing is unlocked by
the redirect back from Stripe; the webhook is the only thing that grants
access, because a browser that never came back would otherwise leave a paid
customer with nothing.

**Staffing a course.** An admin creates a course with no tutor. Tutors see it
on Find Courses and apply. The admin accepts one, which assigns them and
rejects the rest in the same operation, because a course with two accepted
applications is a state nobody should have to reason about.

**Running a course.** Sessions are scheduled against tutor availability, held
over Zoom, and marked attended. Assignments are read out of Google Classroom
through our server, so **students never sign in to Google**. Booking the course
is what grants access to the work.

**Admissions counselling.** A parent subscribes to a tier, picks advising slots,
and a counselor is assigned. Students track applications, deadlines and essays,
and documents live in Google Drive under one Yakal account.

**Talking.** Every role can message the people they are connected to. Parents
can read their children's conversations, which is a deliberate safeguarding
decision rather than an oversight. Messages and notifications are realtime.

## Where the money goes

Parents pay Stripe. Tutors and counsellors are paid out through Stripe Connect,
or by hand if they have not connected a bank; `earnings` records either way, so
the ledger does not depend on which path was used.

Money is never transferred to a payee before the work is delivered. An earning
is written when a lesson completes, not when it is bought, and it waits out a
hold before it moves, so anything a parent has paid for but not yet received is
still ours to refund.

## The public site

The marketing pages at `/` are part of the same app: landing, blog, tutor
profiles, testimonials. They are readable signed out, which is why a handful of
tables and one view are deliberately exposed to the `anon` role. That exposure
is the sharpest edge in the codebase and is covered in
[data-model.md](data-model.md).
