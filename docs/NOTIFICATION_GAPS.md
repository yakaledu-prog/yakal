# Notification gaps

Actions that change something a person is waiting on, where nothing tells
them. Written down because the failure is invisible: the feature works, the
row is correct, and the only symptom is somebody finding out late or not at
all.

Two separate problems live here.

1. **Templates that exist and are never sent.** Somebody wrote the wording,
   nothing calls it. These are the cheap ones: the message is already
   drafted, only the call site is missing.
2. **Actions with no template at all.**

There is a third failure mode worth knowing about, because it is silent.
`notifications.type` is checked against a fixed list in the database. Sending
a type that is not on that list fails the insert, and the send path reports
failures rather than throwing, so the notification simply never appears and
nothing in the logs is obviously wrong. Any new type needs a migration
widening `notifications_type_check` alongside it. See
`20260810000100_notification_session_moved.sql`.

---

## Templates written but never fired

Each of these is a `NotificationTemplate` in `src/lib/notifications/templates/`
with no caller anywhere in `src/` or `api/`.

- [ ] **`assignment`** - work set on a course. A student is told nothing when
  a tutor adds homework, so it is found only by opening the course.
- [ ] **`parentLink`** - a parent asking to link to a student, and the answer.
  Both sides of that exchange are currently silent.
- [ ] **`accountApproved`** - a tutor or counselor being approved or rejected
  after signing up. They are left refreshing the page to find out.
- [ ] **`unlockRequest`** - a student asking for content to be unlocked.
- [ ] **`admissionsPlan`** - fired from `api/_utils/fulfil.ts` on purchase, so
  the plan case is covered; no client-side path uses it.
- [ ] **`messageReport`** - a reported message. Admins are not told, so a
  report waits until somebody opens the reports page.
- [ ] **`booking`** - a session being booked. The template is written and
  reads well. Nothing calls it: `bookAndPay` creates the session and sends
  nothing. This is the highest value one on the list, because the email it
  would send is the one that tells a family the hour exists.

## Actions with no template and no notification

- [ ] **Session cancelled.** The published policy talks about cancellation
  fees, and the other side is told nothing when one happens.
- [ ] **A tutor marking a session done.** The hour is deducted and no one
  says so.
- [ ] **Payment failed / card expiring.** Stripe knows; nobody here passes it
  on, so the first sign is a booking that will not go through.
- [ ] **A course a student is enrolled on being edited or deactivated.**
- [ ] **A diagnostic being published** to a student who is waiting for one.
- [ ] **An essay being returned with comments.** `essay_review` exists and is
  wired, but only for the review being created, not for later comments.

## Done

- [x] **Session moved.** Nothing was sent, while the booking email was
  actively telling people that "moving the hour in the app tells the other
  side". The mover never hears about their own change: a tutor moving an hour
  tells the student, anyone else tells the tutor. A tutor's reason rides along
  with it, since a tutor is the only one asked for one.
  `sessionMoved`, fired from `rescheduleSession`.

---

## Notes

- `sendFromTemplate` writes the in-app row and the email from one definition,
  so wiring one of the unfired templates is usually a single call.
- Failures are reported, never thrown, on purpose: a session that moved must
  not report failure because a mail server was briefly down. The cost is that
  a missing notification is quiet, which is what this file is for.
- Locally all mail goes to Mailpit at `http://127.0.0.1:54324`. An empty
  Mailpit after an action is the fastest way to find the next entry for this
  list.
