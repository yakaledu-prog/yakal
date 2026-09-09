# Recommendations

You asked how recommenders are handled and said you were unsure of the process
itself. `01-how-us-admissions-works.md` covers the process. This is what the
software does with it.

## It is better than you feared

The table is well designed and already models things the screen does not use:

```
recommender_name    relationship      status
recommender_email   asked_on          ferpa_waived
letter_url          invited_on        thank_you_sent
notes               submitted_on
```

The student's Recommendations tab shows each recommender with their role, a
three-step progress indicator, and a status. "asked 26 days ago" appears in
amber once it has been a while, which is exactly the right nudge for a process
where the student's main job is waiting and chasing.

## How a recommender is actually handled today

The student self-tracks. They add a recommender, then move a dropdown through
Asked, Invited on Common App, Letter submitted. **Yakal never emails the
recommender**, and the footnote says why:

> Letters go straight from your recommender to Common App, so you never handle
> the file yourself.

**That is the correct design and you should keep it.** The Common App sends the
invitation and receives the letter; a teacher does not want a second system
asking them for the same document, and a letter arriving through Yakal would not
count. So this is a tracker, not a mailbox, and it should stay one.

Two consequences follow:

- `recommender_email` is collected and never used for anything. Either use it to
  prefill what the student pastes into the Common App, or stop asking.
- `letter_url` should probably never be populated. A student is not supposed to
  hold the file.

## What is missing

### The FERPA waiver is a sentence, not a state

`ferpa_waived` exists per recommender and is never set or shown. The waiver
appears only as static advice at the bottom of the list:

> Remember to waive your right to view them.

The order matters and the product does not enforce or even reflect it. The
waiver is signed **once per application, before invitations go out**, and an
unwaived letter is worth materially less. A student who invites three teachers
and then waives has done it in the wrong order and nothing tells them.

Since it is once per application rather than per recommender, the column is
arguably on the wrong table. It belongs beside the student's application, with
the recommender list refusing to move anyone to "Invited" until it is set.
That single gate is worth more than any other change on this page, because it is
the one place where the software can prevent a mistake the student cannot undo.

### Nobody knows who is assigned where

The Common App lets a student assign specific recommenders to specific colleges,
and colleges differ in how many letters they take. The product has a flat list of
recommenders and a separate per-college "Recommendations submitted 2/3", with
nothing joining them. A student with four recommenders and twelve colleges cannot
answer "who did I assign to Stanford" here.

### thank_you_sent is dead

The column exists, nothing sets it. It is a small thing that a counsellor would
genuinely nag about, and it is one checkbox.

## Suggested order

1. **Gate invitations on the waiver**, and move it to the application rather
   than the recommender. Prevents a real, irreversible mistake.
2. **Use `recommender_email`** to prefill, or drop the field.
3. Assignment per college, if and when students are running more than a few
   applications.
4. `thank_you_sent` as a checkbox, whenever the row is next touched.

## For the other roles

You asked that changes be checked across roles. For recommendations:

- **Counsellor**: sees the same list read-only on `/counselor/students`. If the
  waiver becomes a gate, this is where they need to see it is missing, because
  chasing it is their job rather than the student's.
- **Parent**: sees nothing about recommendations today. That is probably right.
  A letter is between a student and a teacher, and a parent asking about it is
  the classic way to damage it. Leave the parent out deliberately, and say so in
  the code so nobody "fixes" it later.
