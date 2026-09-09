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
that is not a Google account, which in Ethiopia is common.

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

Essay review is not defensible on its own. Every counselling outfit does it, and
a language model does a passable first pass for nothing. Building a better
comment box is table stakes, not an advantage.

What is defensible is in `01-how-us-admissions-works.md`: Yakal is an Ethiopian
company whose students are international applicants, and the international path
is the part the American tools handle worst.

- FAFSA appears on every college for every student. **International students
  cannot file it**, so the product currently instructs its core customer to do
  something impossible. `requirementsService.ts:42`.
- English proficiency testing is compulsory for these students and is modelled
  only as a score field and a document slot. It should be a requirement with a
  deadline, like the transcript.
- The **F-1 visa process does not exist in the product at all**. Searching for
  "visa" returns only the credit card brand. No I-20, no SEVIS fee, no embassy
  interview, no proof of funds. For an Ethiopian family this is the most
  frightening part of the year and the part where a refusal undoes everything.
- Financial aid strategy for internationals, where need-aware admission means
  asking for money changes the odds, is advice worth real money and is absent.

A product that took a student from Addis to a US campus, including the parts
after the acceptance letter, would be doing something Naviance and Scoir do not
do and are not trying to do. That is worth more than a better comment box, and
the comment box should still be built, because it is an afternoon.
