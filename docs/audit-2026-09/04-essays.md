# The essay loop

You called this clumsy and weak. It is, and the reason is narrower than it looks:
the data model is fine, and almost everything missing is missing from the screen
rather than from the database.

## The counsellor cannot say anything

The whole review is two buttons, **Send back** and **Finished**. There is no
field to write in.

`essay_reviews` has had a `note` column from the start. `reviewEssay()` accepts
one and writes it:

```ts
export async function reviewEssay(input: {
  essayId: string; counselorId: string; action: ReviewAction;
  note?: string;
  ...
```

The counsellor page never passes it (`CounselorEssays.tsx:138`). So the student
gets an email saying their essay came back, and nothing about why. The counsellor
has no way to tell them, short of opening a separate messaging thread and hoping
the student connects the two.

For a service whose entire value is expert feedback, the feedback has nowhere to
go. **This is the single highest-value fix in the counselling product and it is
roughly an afternoon**: a required note on Send back, optional on Finished, shown
on the student's essay row and included in the email that already goes out.

## "0 of 5 rounds" is the wrong number

Every row on the counsellor's queue reads like:

```
MIT, what you build for fun
Amen Worku - Massachusetts Institute of Technology - 200 words
0 of 5 rounds
```

That 5 is `supp_essays_limit`, the number of supplemental essays the **plan**
covers. Rounds on a supplement are not capped at all. The tooltip on the same row
says the right thing; the visible label does not.
`CounselorEssays.tsx:371`.

A counsellor reading it believes they owe five rounds on this one essay. They
owe five essays across the whole plan.

## Where the document actually lives

Each essay has a **Create doc** button, and it genuinely works: it creates a real
Google Doc through the Drive API. The counsellor's row then says "No document
yet" until one exists, which is honest.

One thing surfaced in the server log during testing:

```
[drive] could not share <id> with counselor@yakal.com Forbidden.
  "you cannot share with counselor@yakal.com because they do not have a Google Account"
```

That is only the demo accounts, and it would work with real addresses. But it
fails silently: nobody is told the counsellor cannot open the document. Worth a
visible error, because in production it will happen to anyone using an address
that is not a Google account, which plenty of families use.

## What "better than a dropdown" should mean

You asked for something better without more verbosity. The smallest set that
turns this into a real service:

1. **A note on every action.** Above. Nothing else on this list matters as much.
2. **Show the history.** `essay_reviews` already stores every action with a
   timestamp and the counsellor's name, and `getEssayReviews` already reads it.
   A student seeing "round 2, returned by Daniel on 3 October, with his note"
   understands what they bought. Right now that history is written and never
   displayed.
3. **Make the three header counts filter the list.** "1 waiting on me / 2 with
   the student / 3 finished" currently look clickable and are not, so a
   counsellor cannot see the other five essays from here.
4. **Say which round is included and which is extra.** Once the count is right,
   a counsellor refusing a fourth round on an Essential plan has something to
   point at, and a family upgrading knows why.

## The moat question

You asked for something defensible rather than verbose. Essay review is not it
on its own: every counselling outfit does it, and a language model does a
passable first pass for nothing. A better comment box is table stakes.

What is defensible is the part nobody enjoys building, which is the record. The
model here is already unusually good at it: every review action is stored with
its actor, its timestamp and its note; rounds are counted by a trigger rather
than by a page; quotas are computed from what actually happened rather than from
what somebody ticked. That is the spine of something Naviance and Scoir do not
really have, because they are school-side tools rather than a service being sold
to a family.

Three things would turn that record into the product:

1. **Show the history to the family.** It exists and has never been displayed.
   A parent who can see round 2 returned on 3 October with the counsellor's
   note, and round 3 approved on the 11th, is a parent who renews. Right now
   they are paying $250 a month for something they cannot see happening.
2. **Make the counsellor's queue the whole job.** It already sorts by deadline
   across every student, which is the correct and non-obvious thing to do. Add
   the recommendation chase and the aid deadlines to the same queue and it
   becomes the thing a counsellor opens each morning.
3. **Own the end of the season.** Deferrals, waitlist letters, and comparing and
   appealing aid packages, in March and April. That is where the value is
   densest, where families most need somebody who has done it before, and where
   the product currently stops. It is also exactly when a monthly plan gets
   cancelled, so it defends revenue as well as being worth having.

None of that is a new subsystem. It is displaying what is already recorded and
extending the queue that already exists.
